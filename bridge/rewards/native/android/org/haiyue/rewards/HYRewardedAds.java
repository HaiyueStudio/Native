package org.haiyue.rewards;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.google.android.gms.ads.*;
import com.google.android.gms.ads.rewarded.*;
import com.google.ads.mediation.admob.AdMobAdapter;
import com.google.android.ump.*;
import org.json.JSONObject;

/** Reusable AdMob adapter. No mediation: Google's reward callback precedes dismissal. */
public final class HYRewardedAds {
    private static String processPolicy;
    private boolean underAgeOfConsent, configured;
    public boolean configurePolicy(String json) {
        synchronized (HYRewardedAds.class) {
            if (disposed || busy) return false;
            try {
                JSONObject value = new JSONObject(json);
                String rating = value.getString("maxAdContentRating");
                if (!java.util.Arrays.asList("G", "PG", "T", "MA").contains(rating)) return false;
                boolean underAge = value.getBoolean("underAgeOfConsent");
                String treatment = value.getString("ageTreatment");
                if (!java.util.Arrays.asList("unspecified", "child", "teen").contains(treatment)) return false;
                AgeRestrictedTreatment age = AgeRestrictedTreatment.valueOf(treatment.toUpperCase(java.util.Locale.ROOT));
                String key = rating + ":" + underAge + ":" + treatment;
                if (processPolicy != null && !processPolicy.equals(key)) return false;
                MobileAds.setRequestConfiguration(MobileAds.getRequestConfiguration().toBuilder()
                    .setPublisherPrivacyPersonalizationState(RequestConfiguration.PublisherPrivacyPersonalizationState.DISABLED)
                    .setMaxAdContentRating(rating).setAgeRestrictedTreatment(age).build());
                underAgeOfConsent = underAge; processPolicy = key; configured = true;
                return true;
            } catch (Exception e) { return false; }
        }
    }
    public interface Events { void onEvent(String event); }
    private final Handler handler = new Handler(Looper.getMainLooper());
    private ConsentInformation consent;
    private Events events;
    private RewardedAd ad;
    private boolean busy, disposed, loading;
    private int generation, deadlineGeneration;
    public boolean privacyRequired(android.content.Context context) {
        consent = UserMessagingPlatform.getConsentInformation(context);
        return consent != null && consent.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
    }
    private String stage = "configuration";
    private static String failureEvent(String stage, String code, String phase, String domain, Integer sdkCode, AdError cause) {
        try {
            JSONObject value = new JSONObject().put("stage", stage).put("code", code);
            if (domain != null) value.put("sdk", new JSONObject().put("domain", domain).put("code", sdkCode));
            if (cause != null) value.put("underlying", new JSONObject().put("domain", cause.getDomain()).put("code", cause.getCode()));
            return "error:" + phase + ":" + value.toString();
        } catch (org.json.JSONException e) { return "error:" + phase; }
    }
    private static String localFailure(String stage, String code) { return failureEvent(stage, code, "unavailable", null, null, null); }
    private void fail(String code) { end(localFailure(stage, code)); }
    private void fail(FormError error) {
        // UMP exposes a code, but no domain accessor; use a documented provider namespace.
        end(failureEvent(stage, "sdk_error", "unavailable", "com.google.android.ump", error.getErrorCode(), null));
    }
    private void fail(AdError error) {
        String code = "sdk_error", phase = "unavailable";
        if (stage.equals("ad_load") && error.getDomain().equals(MobileAds.ERROR_DOMAIN)) {
            if (error.getCode() == AdRequest.ERROR_CODE_NO_FILL) code = "no_fill";
            if (error.getCode() == AdRequest.ERROR_CODE_NETWORK_ERROR) { code = "network"; phase = "offline"; }
        }
        end(failureEvent(stage, code, phase, error.getDomain(), error.getCode(), error.getCause()));
    }
    private Runnable pendingPresentation;
    private boolean active(int token) { return !disposed && busy && token == generation; }
    private void emit(String value) { if (events != null) events.onEvent(value); }
    private void end(String value) {
        loading = false; busy = false; ++generation; pendingPresentation = null;
        Events callback = events; events = null; ad = null;
        if (callback != null) callback.onEvent(value);
    }
    private void deadline(int token, long milliseconds) {
        loading = true;
        final int deadlineToken = ++deadlineGeneration;
        handler.postDelayed(() -> { if (loading && token == generation && deadlineToken == deadlineGeneration) fail("timeout"); }, milliseconds);
    }
    private void preparePresentation(Activity activity, int token, Runnable show) {
        if (!active(token)) return;
        if (activity.isFinishing() || activity.isDestroyed()) { fail("inactive"); return; }
        loading = false;
        pendingPresentation = () -> {
            if (!active(token)) return;
            if (activity.isFinishing() || activity.isDestroyed()) { fail("inactive"); return; }
            show.run();
        };
        emit("presenting");
    }
    public void continuePresentation(boolean ready) {
        handler.post(() -> {
            Runnable show = pendingPresentation; pendingPresentation = null;
            if (show == null) return;
            if (!ready || disposed) { fail(disposed ? "disposed" : "presentation_rejected"); return; }
            show.run();
        });
    }
    public void perform(Activity activity, String action, String unit, Events callback) {
        activity.runOnUiThread(() -> {
            if (!configured || disposed || busy || activity.isFinishing() || activity.isDestroyed()) {
                callback.onEvent(localFailure(!configured ? "configuration" : "lifecycle",
                    !configured ? "policy_rejected" : disposed ? "disposed" : busy ? "busy" : "inactive")); return;
            }
            if (!action.equals("show") && !action.equals("privacy")) { callback.onEvent(localFailure("configuration", "invalid_action")); return; }
            busy = true; events = callback; final int token = ++generation;
            consent = UserMessagingPlatform.getConsentInformation(activity);
            stage = "consent_update";
            deadline(token, 20000);
            consent.requestConsentInfoUpdate(activity, new ConsentRequestParameters.Builder().setTagForUnderAgeOfConsent(underAgeOfConsent).build(), () -> {
                if (!active(token)) return;
                if (action.equals("privacy")) {
                    if (!privacyRequired(activity)) { end("closed"); return; }
                    stage = "privacy_present";
                    preparePresentation(activity, token, () -> UserMessagingPlatform.showPrivacyOptionsForm(activity,
                        error -> { if (token == generation) { if (error == null) end("closed"); else fail(error); } }));
                } else if (consent.getConsentStatus() == ConsentInformation.ConsentStatus.REQUIRED) {
                    stage = "consent_load";
                    deadline(token, 20000);
                    UserMessagingPlatform.loadConsentForm(activity, form -> {
                        if (!active(token)) return;
                        stage = "consent_present";
                        preparePresentation(activity, token, () -> form.show(activity, error -> {
                            if (token != generation) return;
                            emit("presentation-closed");
                            if (error != null) { fail(error); return; }
                            if (disposed || !consent.canRequestAds()) { fail(disposed ? "disposed" : "consent_unavailable"); return; }
                            initialize(activity, unit, token);
                        }));
                    }, error -> { if (active(token)) fail(error); });
                } else if (consent.canRequestAds()) initialize(activity, unit, token);
                else fail("consent_unavailable");
            }, error -> {
                if (!active(token)) return;
                if (!action.equals("privacy") && consent.canRequestAds()) initialize(activity, unit, token);
                else fail(error);
            });
        });
    }
    private void initialize(Activity activity, String unit, int token) {
        if (!active(token)) return;
        // New phase invalidates the consent deadline without invalidating callbacks.
        loading = false;
        final int adToken = ++generation;
        stage = "sdk_initialize";
        deadline(adToken, 45000);
        MobileAds.initialize(activity.getApplicationContext(), status -> handler.post(() -> {
            if (!active(adToken)) return;
            // SDK 25.5 throws if this is called from configurePolicy before
            // initialize. Disable it here, before any ad request is constructed.
            try {
                if (!MobileAds.putPublisherFirstPartyIdEnabled(false)) { fail("policy_rejected"); return; }
            } catch (Exception error) { fail("policy_rejected"); return; }
            Bundle extras = new Bundle(); extras.putString("npa", "1");
            AdRequest request = new AdRequest.Builder().addNetworkExtrasBundle(AdMobAdapter.class, extras).build();
            stage = "ad_load";
            RewardedAd.load(activity, unit, request, new RewardedAdLoadCallback() {
                @Override public void onAdFailedToLoad(LoadAdError error) {
                    if (active(adToken)) fail(error);
                }
                @Override public void onAdLoaded(RewardedAd loaded) {
                    if (!active(adToken)) return;
                    stage = "ad_present";
                    ad = loaded;
                    ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                        @Override public void onAdDismissedFullScreenContent() { if (adToken == generation) end("closed"); }
                        @Override public void onAdFailedToShowFullScreenContent(AdError error) { if (adToken == generation) fail(error); }
                    });
                    preparePresentation(activity, adToken, () -> ad.show(activity, reward -> { if (adToken == generation) emit("earned"); }));
                }
            });
        }));
    }
    public void dispose() {
        disposed = true;
        // Keep earned/dismiss callbacks alive if an ad is already on screen.
        if (loading || pendingPresentation != null) { stage = "lifecycle"; fail("disposed"); }
    }
}
