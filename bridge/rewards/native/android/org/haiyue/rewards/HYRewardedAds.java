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
        handler.postDelayed(() -> { if (loading && token == generation) end("error:unavailable"); }, milliseconds);
    }
    private void preparePresentation(Activity activity, int token, Runnable show) {
        if (!active(token) || activity.isFinishing() || activity.isDestroyed()) { end("error:unavailable"); return; }
        loading = false;
        pendingPresentation = () -> {
            if (!active(token) || activity.isFinishing() || activity.isDestroyed()) { end("error:unavailable"); return; }
            show.run();
        };
        emit("presenting");
    }
    public void continuePresentation(boolean ready) {
        handler.post(() -> {
            Runnable show = pendingPresentation; pendingPresentation = null;
            if (show == null) return;
            if (!ready || disposed) { end("error:unavailable"); return; }
            show.run();
        });
    }
    public void perform(Activity activity, String action, String unit, Events callback) {
        activity.runOnUiThread(() -> {
            if (disposed || busy || activity.isFinishing() || activity.isDestroyed()) { callback.onEvent("error:unavailable"); return; }
            busy = true; events = callback; final int token = ++generation;
            consent = UserMessagingPlatform.getConsentInformation(activity);
            deadline(token, 20000);
            consent.requestConsentInfoUpdate(activity, new ConsentRequestParameters.Builder().build(), () -> {
                if (!active(token)) return;
                if (action.equals("privacy")) {
                    if (!privacyRequired(activity)) { end("closed"); return; }
                    preparePresentation(activity, token, () -> UserMessagingPlatform.showPrivacyOptionsForm(activity,
                        error -> { if (token == generation) end(error == null ? "closed" : "error:unavailable"); }));
                } else if (consent.getConsentStatus() == ConsentInformation.ConsentStatus.REQUIRED) {
                    UserMessagingPlatform.loadConsentForm(activity, form -> {
                        if (!active(token)) return;
                        preparePresentation(activity, token, () -> form.show(activity, error -> {
                            if (token != generation) return;
                            emit("presentation-closed");
                            if (error != null || disposed || !consent.canRequestAds()) { end("error:unavailable"); return; }
                            initialize(activity, unit, token);
                        }));
                    }, error -> { if (active(token)) end("error:unavailable"); });
                } else if (consent.canRequestAds()) initialize(activity, unit, token);
                else end("error:unavailable");
            }, error -> {
                if (!active(token)) return;
                if (!action.equals("privacy") && consent.canRequestAds()) initialize(activity, unit, token);
                else end("error:unavailable");
            });
        });
    }
    private void initialize(Activity activity, String unit, int token) {
        if (!active(token)) return;
        // New phase invalidates the consent deadline without invalidating callbacks.
        loading = false;
        final int adToken = ++generation;
        deadline(adToken, 45000);
        MobileAds.initialize(activity.getApplicationContext(), status -> handler.post(() -> {
            if (!active(adToken)) return;
            Bundle extras = new Bundle(); extras.putString("npa", "1");
            AdRequest request = new AdRequest.Builder().addNetworkExtrasBundle(AdMobAdapter.class, extras).build();
            RewardedAd.load(activity, unit, request, new RewardedAdLoadCallback() {
                @Override public void onAdFailedToLoad(LoadAdError error) {
                    if (active(adToken)) end(error.getCode() == AdRequest.ERROR_CODE_NETWORK_ERROR ? "error:offline" : "error:unavailable");
                }
                @Override public void onAdLoaded(RewardedAd loaded) {
                    if (!active(adToken)) return;
                    ad = loaded;
                    ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                        @Override public void onAdDismissedFullScreenContent() { if (adToken == generation) end("closed"); }
                        @Override public void onAdFailedToShowFullScreenContent(AdError error) { if (adToken == generation) end("error:unavailable"); }
                    });
                    preparePresentation(activity, adToken, () -> ad.show(activity, reward -> { if (adToken == generation) emit("earned"); }));
                }
            });
        }));
    }
    public void dispose() {
        disposed = true;
        // Keep earned/dismiss callbacks alive if an ad is already on screen.
        if (loading || pendingPresentation != null) end("error:unavailable");
    }
}
