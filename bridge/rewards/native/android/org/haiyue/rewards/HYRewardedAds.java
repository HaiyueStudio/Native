package org.haiyue.rewards;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.google.android.gms.ads.*;
import com.google.android.gms.ads.rewarded.*;
import com.google.ads.mediation.admob.AdMobAdapter;
import com.google.android.ump.*;

/** Reusable AdMob adapter. No mediation: Google's reward callback precedes dismissal. */
public final class HYRewardedAds {
    public interface Events { void onEvent(String event); }
    private final Handler handler = new Handler(Looper.getMainLooper());
    private ConsentInformation consent;
    private Events events;
    private RewardedAd ad;
    private boolean busy, disposed, loading;
    private int generation;
    public boolean privacyRequired(android.content.Context context) {
        consent = UserMessagingPlatform.getConsentInformation(context);
        return consent != null && consent.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
    }
    private void emit(String value) { if (events != null) events.onEvent(value); }
    private void end(String value) { loading = false; busy = false; ++generation; emit(value); events = null; ad = null; }
    public void perform(Activity activity, String action, String unit, Events callback) {
        activity.runOnUiThread(() -> {
            if (disposed || busy || activity.isFinishing() || activity.isDestroyed()) { callback.onEvent("error:unavailable"); return; }
            busy = true; events = callback;
            consent = UserMessagingPlatform.getConsentInformation(activity);
            if (action.equals("privacy")) {
                consent.requestConsentInfoUpdate(activity, new ConsentRequestParameters.Builder().build(), () -> {
                    if (disposed) { end("error:unavailable"); return; }
                    UserMessagingPlatform.showPrivacyOptionsForm(activity, error -> end(error == null ? "closed" : "error:unavailable"));
                }, error -> end("error:unavailable"));
                return;
            }
            consent.requestConsentInfoUpdate(activity, new ConsentRequestParameters.Builder().build(), () -> {
                if (disposed) { end("error:unavailable"); return; }
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, error -> {
                    if (disposed || !consent.canRequestAds()) { end("error:unavailable"); return; }
                    initialize(activity, unit);
                });
            }, error -> {
                if (!disposed && consent.canRequestAds()) initialize(activity, unit);
                else end("error:unavailable");
            });
        });
    }
    private void initialize(Activity activity, String unit) {
        loading = true;
        final int token = ++generation;
        handler.postDelayed(() -> { if (loading && token == generation) end("error:unavailable"); }, 45000);
        MobileAds.initialize(activity.getApplicationContext(), status -> handler.post(() -> {
            if (!loading || disposed || token != generation) return;
            Bundle extras = new Bundle(); extras.putString("npa", "1");
            AdRequest request = new AdRequest.Builder().addNetworkExtrasBundle(AdMobAdapter.class, extras).build();
            RewardedAd.load(activity, unit, request, new RewardedAdLoadCallback() {
                @Override public void onAdFailedToLoad(LoadAdError error) {
                    if (token == generation) end(error.getCode() == AdRequest.ERROR_CODE_NETWORK_ERROR ? "error:offline" : "error:unavailable");
                }
                @Override public void onAdLoaded(RewardedAd loaded) {
                    if (!loading || token != generation) return;
                    loading = false;
                    if (disposed || activity.isFinishing() || activity.isDestroyed()) { end("error:unavailable"); return; }
                    ad = loaded;
                    ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                        @Override public void onAdDismissedFullScreenContent() { end("closed"); }
                        @Override public void onAdFailedToShowFullScreenContent(AdError error) { end("error:unavailable"); }
                    });
                    emit("presenting");
                    ad.show(activity, reward -> emit("earned"));
                }
            });
        }));
    }
    public void dispose() {
        disposed = true;
        // Keep earned/dismiss callbacks alive if an ad is already on screen.
        if (loading) end("error:unavailable");
    }
}
