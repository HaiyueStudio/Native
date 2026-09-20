package org.haiyue.calendarstore;

import android.app.Activity;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import com.android.billingclient.api.*;
import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/** Play owns checkout. Purchased tokens must be verified/acknowledged by our server. */
public final class HYCalendarBilling implements PurchasesUpdatedListener {
    public interface Completion { void complete(String json); }
    public interface Listener { void changed(); }
    private final Handler main = new Handler(Looper.getMainLooper());
    private final String productID;
    private final BillingClient client;
    private Listener listener;
    private Completion purchaseCompletion;
    private boolean connecting, closed;
    private final List<ConnectionJob> waiting = new ArrayList<>();
    private static final class ConnectionJob {
        final Runnable ready; final Completion done;
        ConnectionJob(Runnable ready, Completion done) { this.ready = ready; this.done = done; }
    }
    public HYCalendarBilling(Context context, String productID, Listener listener) {
        this.productID = productID;
        this.listener = listener;
        client = BillingClient.newBuilder(context.getApplicationContext()).setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection().build();
    }
    private static JSONObject json(String key, Object value) {
        JSONObject result = new JSONObject(); try { result.put(key, value); } catch (Exception ignored) {} return result;
    }
    private void reply(Completion done, JSONObject value) { main.post(() -> { if (!closed) done.complete(value.toString()); }); }
    private void error(Completion done, int code) {
        String phase = code == BillingClient.BillingResponseCode.USER_CANCELED ? "cancelled"
            : code == BillingClient.BillingResponseCode.NETWORK_ERROR || code == BillingClient.BillingResponseCode.SERVICE_DISCONNECTED || code == BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE ? "offline"
            : code == BillingClient.BillingResponseCode.BILLING_UNAVAILABLE || code == BillingClient.BillingResponseCode.ITEM_UNAVAILABLE || code == BillingClient.BillingResponseCode.FEATURE_NOT_SUPPORTED ? "unavailable" : "error";
        reply(done, json("error", phase));
    }
    private void connected(Runnable ready, Completion done) {
        if (closed) return;
        if (client.isReady()) { ready.run(); return; }
        waiting.add(new ConnectionJob(ready, done));
        if (connecting) return;
        connecting = true;
        client.startConnection(new BillingClientStateListener() {
            public void onBillingSetupFinished(BillingResult result) {
                main.post(() -> {
                    connecting = false;
                    List<ConnectionJob> jobs = new ArrayList<>(waiting); waiting.clear();
                    for (ConnectionJob job : jobs) {
                        if (closed) return;
                        if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) job.ready.run();
                        else error(job.done, result.getResponseCode());
                    }
                });
            }
            public void onBillingServiceDisconnected() { connecting = false; }
        });
    }
    public void call(String action, Activity activity, Completion callback) {
        AtomicBoolean finished = new AtomicBoolean();
        Runnable timeout = () -> { if (!closed && finished.compareAndSet(false, true)) callback.complete("{\"error\":\"offline\"}"); };
        Completion done = value -> {
            if (finished.compareAndSet(false, true)) { main.removeCallbacks(timeout); callback.complete(value); }
        };
        // A late checkout callback still emits changed(), so a timeout does not
        // lose a completed purchase or grant access without verification.
        main.postDelayed(timeout, action.equals("purchase") ? 300000 : 30000);
        main.post(() -> connected(() -> {
            if (finished.get() || closed) return;
            if (action.equals("product") || action.equals("purchase")) queryProduct(action, activity, done);
            else if (action.equals("access")) {
                client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (result, purchases) -> {
                    if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { error(done, result.getResponseCode()); return; }
                    JSONArray records = new JSONArray();
                    for (Purchase purchase : purchases) if (purchase.getProducts().contains(productID)) {
                        JSONObject item = json("token", purchase.getPurchaseToken());
                        try { item.put("pending", purchase.getPurchaseState() == Purchase.PurchaseState.PENDING); item.put("purchased", purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED); } catch (Exception ignored) {}
                        records.put(item);
                    }
                    reply(done, json("purchases", records));
                });
            } else reply(done, json("error", "unavailable"));
        }, done));
    }
    private void queryProduct(String action, Activity activity, Completion done) {
        QueryProductDetailsParams.Product item = QueryProductDetailsParams.Product.newBuilder().setProductId(productID).setProductType(BillingClient.ProductType.INAPP).build();
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(item)).build(), (result, query) -> main.post(() -> {
            if (closed) return;
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { error(done, result.getResponseCode()); return; }
            ProductDetails product = null;
            for (ProductDetails p : query.getProductDetailsList()) if (productID.equals(p.getProductId())) product = p;
            if (product == null || product.getOneTimePurchaseOfferDetails() == null) { reply(done, json("error", "unavailable")); return; }
            ProductDetails.OneTimePurchaseOfferDetails offer = product.getOneTimePurchaseOfferDetails();
            if (action.equals("product")) { reply(done, json("price", offer.getFormattedPrice())); return; }
            if (activity == null || activity.isFinishing() || purchaseCompletion != null) { reply(done, json("error", "unavailable")); return; }
            // Fresh ProductDetails for every launch; no cached price/offer token.
            BillingFlowParams.ProductDetailsParams.Builder selection = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product);
            if (offer.getOfferToken() != null) selection.setOfferToken(offer.getOfferToken());
            purchaseCompletion = done;
            BillingResult launch = client.launchBillingFlow(activity, BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(selection.build())).build());
            if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                purchaseCompletion = null;
                if (launch.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) { reply(done, json("result", "changed")); notifyChange(); }
                else error(done, launch.getResponseCode());
            }
        }));
    }
    public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        main.post(() -> {
            if (closed) return;
            Completion done = purchaseCompletion; purchaseCompletion = null;
            if (result.getResponseCode() == BillingClient.BillingResponseCode.OK || result.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
                boolean pending = false;
                if (purchases != null) for (Purchase p : purchases) if (p.getProducts().contains(productID) && p.getPurchaseState() == Purchase.PurchaseState.PENDING) pending = true;
                if (done != null) reply(done, json("result", pending ? "pending" : "changed"));
                notifyChange();
            } else if (done != null) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) reply(done, json("result", "cancelled"));
                else error(done, result.getResponseCode());
            }
        });
    }
    private void notifyChange() { if (!closed && listener != null) listener.changed(); }
    public void dispose() { closed = true; listener = null; purchaseCompletion = null; waiting.clear(); main.removeCallbacksAndMessages(null); client.endConnection(); }

    public static String tokenHash(String token) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(); for (byte b : bytes) hex.append(String.format("%02x", b & 255)); return hex.toString();
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
    /** Verify the server signature before parsing a cached grant. No secret ships in the APK. */
    public static String verifyLease(String lease, String publicKey, String productID, String packageName, String installationID, long now) {
        try {
            String[] parts = lease.split("\\."); if (parts.length != 2 || lease.length() > 16384) return "null";
            String pem = publicKey.replace("-----BEGIN PUBLIC KEY-----", "").replace("-----END PUBLIC KEY-----", "").replaceAll("\\s", "");
            Signature verifier = Signature.getInstance("SHA256withRSA");
            verifier.initVerify(KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(Base64.decode(pem, Base64.DEFAULT))));
            verifier.update(parts[0].getBytes(StandardCharsets.US_ASCII));
            if (!verifier.verify(Base64.decode(parts[1], Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING))) return "null";
            JSONObject value = new JSONObject(new String(Base64.decode(parts[0], Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING), StandardCharsets.UTF_8));
            if (!productID.equals(value.getString("productId")) || !packageName.equals(value.getString("packageName")) || !installationID.equals(value.getString("installationId"))) return "null";
            long issued = value.getLong("issuedAt"), expires = value.getLong("expiresAt");
            if (issued > now + 300 || expires <= now || expires <= issued || expires - issued > 7 * 86400 || !(value.get("owned") instanceof Boolean)) return "null";
            return value.toString();
        } catch (Exception e) { return "null"; }
    }
}
