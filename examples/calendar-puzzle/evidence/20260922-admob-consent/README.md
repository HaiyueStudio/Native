# iOS consent and rewarded-ad verification — 2026-09-22

## Implementation

- Reusable reward controller/gateway initialize consent once per host session, after the first frame and purchase reconciliation. iOS refreshes UMP; free users see required forms, paid users refresh privacy requirements without an unsolicited ad-consent form. Startup never initializes Mobile Ads or preloads an ad.
- SDK network failures release the render/input pause and leave the wallet unchanged. Explicit ad/privacy requests retry the update. Native asynchronous completions are guarded by operation generation and disposal; deadlines cover network operations, not time spent reading a form or watching an ad.
- Settings has a public privacy-policy link in all six languages. The separate ad-privacy control follows the SDK requirement status.
- Development uses the official rewarded test unit. Explicit development-only environment flags can reset UMP and simulate EEA for a registered test device. Release ignores them.

## Automated checks

- Native typecheck passed; 63 tests passed.
- Games typecheck passed; 46 focused Calendar Puzzle tests passed; Calendar Puzzle web build passed.
- Full Games suite: 1,230 passed, 13 failed, 2 cancelled, 20 skipped. Failures/cancellations include Boxbound, Mugen and a repository-wide storage-source assertion. These are outside the edited Calendar Puzzle files; the full suite is **not** reported as passing.
- Signed iOS Debug build passed and was installed on the connected iPhone 15 Plus using team 22T5YFVY2B.

## Device evidence

- Initial two UMP requests timed out after approximately 10 seconds. The journal confirms the game returned to `busy=false, phase=ready` without changing earned credits/ad allowances.
- After the user enabled a working network/VPN, UMP requests completed successfully.
- The isolated reward smoke completed **26/26** checks. The Google test ad was shown and completed by the user. The journal recorded `credits=1, adsRemaining=1, phase=earned`, then the smoke intentionally consumed that credit to verify a usable puzzle hint. The final zero balance was caused by this explicit test action, not a missing reward. Normal gameplay never invokes this smoke without development launch flags.
- Both the installed production AdMob App ID and EEA test parameters were verified. Despite `geography=1` and a test consent reset, Google returned `status=2` (not required), `privacyRequired=false`, `canRequestAds=true`. Therefore actual EEA consent, reject and later privacy-form modification are **not yet verified**. Do not treat this as a consent pass or force a local fabricated consent state.

## Pending manual checks

- The user confirmed the AdMob app ID from the console screenshot: `ca-app-pub-2053256758816744~9316994454`, matching the installed app. A further reset + EEA request in `iphone-eea-after-id-confirmation.log` still returned `status=2`, `privacyRequired=false`, `canRequestAds=true`. The reason for the missing form remains unresolved; app-readiness review is not established as its cause.
- Early ad close without reward remains unverified: the user reports that the supplied test creative has no early-close option. Manual completion with a retained credit is verified below.
- Public policy link opening, then returning to gameplay.
- Real UMP consent/reject/privacy-options forms once the backend returns the published EEA message.

No store submission or live-ad clicking was performed. Account payment/readiness review and App Store privacy-label completion remain separate release tasks.

## Manual reward follow-up

The normal-save (non-smoke) journal `iphone-manual-reward-host.jsonl` records a post-ad resume at time 1790075375642 with `credits=1, adsRemaining=1, busy=false, phase=earned, hint=null`. This independently confirms that manual completion retains the reward. A later interaction used a hint and another ad was requested; no automatic smoke consumed this manual credit. The supplied creative did not expose an early-close option according to the user, so cancellation cannot be marked as device-tested from this creative.

## Simulator diagnosis — 19:39 CST

- Added Debug-only runtime SDK versions/app ID, under-age and geography parameters, consent/form/privacy status, elapsed time, presenter attachment and NSError domain/code/description (including underlying errors). Consent strings and arbitrary error payloads are not logged. Simulator EEA configuration no longer requires a physical-device test ID.
- Rebuilt the full Calendar Puzzle app for iPhone 17 Pro simulator, iOS 26.3.1 (23D8133), x86_64. Build succeeded (`simulator-build.log`); Native 63/63 tests and TypeScript check passed again.
- Launched with `SIMCTL_CHILD_HY_UMP_EEA=1 SIMCTL_CHILD_HY_UMP_RESET=1`. No device ID was supplied because UMP treats simulators as test devices. Correct production App ID, UMP 3.1.0 and GMA 13.10.0 confirmed at runtime.
- `simulator-eea-console.log`: reset started at unknown state, parameters `simulator=true geography=1 underAge=false`; request succeeded in 957 ms with `consentStatus=2` (notRequired), `formStatus=2` (unavailable), `privacyOptionsRequirementStatus=2` (notRequired), `canRequestAds=true`.
- The app was active and presenter attached; `loadAndPresentIfRequired` returned immediately, with no form error. No consent UI, ad or purchase was presented. Saved `simulator-eea.png` and terminated the diagnostic app afterward.
- This independently reproduces the device behavior without relying on a physical-device test identifier. It narrows the problem to the consent-info/configuration path before form presentation; it does **not** establish that pending ad review or account configuration is the cause. Real consent/reject/privacy-options flows remain unverified. Next isolation step: a minimal native UMP example with the same App ID, then SDK/backend escalation if it also returns no form.
- The new diagnostics have been compiled and run in the simulator; the physical iPhone still has the previous diagnostic build.

## Minimal native cross-check — 20:45 CST

- Reproducible standalone source: `../../diagnostics/ump-minimal/`. UIKit Objective-C entry point directly calls UMP; no game code, NativeScript, shared reward bridge, StoreKit or Google Mobile Ads SDK is linked. The same UMP 3.1.0 static simulator framework is used.
- Created dedicated simulator `Calendar UMP Isolation` (iPhone 17 Pro, iOS 26.3.1) to retain the exact same bundle identifier `org.haiyue.games.calendarpuzzle` without replacing the full-game installation. App ID also remains `ca-app-pub-2053256758816744~9316994454`.
- On a fresh simulator, reset UMP, explicitly set under-age false and debug geography EEA. The app was active and the native controller attached.
- `minimal-native-eea-console.log`: request completed in 3,140 ms, returning consent=2 (notRequired), form=2 (unavailable), privacy=2 (notRequired), canRequestAds=true. The subsequent official `loadAndPresentIfRequired` call completed at 3,173 ms with no error or form presentation.
- Screenshot: `minimal-native-eea.png`. No ad, payment or consent choice was triggered. Terminated the probe and shut down the dedicated simulator after capture; no phone installation was changed.
- The same result reproduces with a direct native SDK integration, independently of game rendering, NativeScript, purchase reconciliation and reward/lifecycle wrappers. Exact cause remains unresolved in the shared SDK/request/configuration/backend path. This is not evidence that app readiness review necessarily suppresses UMP. A focused Google SDK/support investigation or SDK-version comparison is the next step.

## UMP 3.0.0 / 3.1.0 comparison — 21:01–21:02 CST

Both official archives were downloaded from Google's version-tagged Swift Package
manifests and SHA-256 verified before extraction:

| SDK | Archive SHA-256 |
| --- | --- |
| 3.0.0 | `5ca3e33572cac088f5bfd1249712d172c20905932402b6fe60b8f544961d5ee1` |
| 3.1.0 | `90fe6bf3b0f4ce0d0199628c0871de58b6f673375148b98d52348aecc86db231` |

Manifests: https://github.com/googleads/swift-package-manager-google-user-messaging-platform/blob/3.0.0/Package.swift
and https://github.com/googleads/swift-package-manager-google-user-messaging-platform/blob/3.1.0/Package.swift.

The same `diagnostics/ump-minimal/main.m` source and compiler command were used;
only the framework search path and output path differed. Both builds succeeded.
Both ran sequentially on the same dedicated simulator, with the same App ID,
bundle ID, unchanged network setup, under-age false, and EEA geography=1. Each
launch reset consent to unknown; runtime logs confirm the actual SDK version.

| Runtime SDK | Request completion | Consent | Form | Privacy options | Error |
| --- | --- | --- | --- | --- | --- |
| 3.0.0 | 1,839 ms | 2 / notRequired | 2 / unavailable | 2 / notRequired | none |
| 3.1.0 | 931 ms | 2 / notRequired | 2 / unavailable | 2 / notRequired | none |

Both returned `canRequestAds=true`; `loadAndPresentIfRequired` completed without a
form. These timings are single diagnostic requests, not a performance benchmark.
Evidence: `ump-3.0.0-eea-console.log`, `ump-3.1.0-eea-console.log`, and matching
`ump-<version>-build.log` files.

No 3.1.0-only regression was observed; reverting to 3.0.0 did not resolve the
missing form. This does not exclude behavior shared by both SDK versions or
establish a backend root cause. Next useful evidence is the SDK network request/
response, or Google support's App ID delivery analysis. The game dependency lock
and phone installation were unchanged. The dedicated simulator was shut down.

## Actual request / response inspection — 21:20–21:21 CST

- Added an opt-in, simulator-only URLSession observer to the isolated native probe.
  The original request object and response bytes are forwarded unchanged; no TLS
  proxy, custom certificate, response replacement or manual replay was used.
- UMP 3.1.0 sent `POST https://fundingchoicesmessages.google.com/a/consent` with
  correct `admob_app_id`, `app_info.package_name`, `sdk_info.version`,
  `tag_for_under_age_of_consent=false`, and `device_info.is_simulator=true`.
  Language was `zh-Hans-CN`. After reset, stored consent data was empty (now redacted
  in exported evidence).
- EEA (public enum=1) encoded `debug_params:[2,4]`. At 21:20:15 CST the HTTPS
  response was HTTP 200 in 1,054 ms, containing an anti-XSSI prefix followed by:

```json
{"consent_signal":"CONSENT_SIGNAL_NOT_REQUIRED","privacy_options_required":"NOT_REQUIRED"}
```

- The subsequent SDK state matched the network response. No form content or reason
  for the not-required decision was present. Thus this outcome originates in the
  response, rather than a game branch or a misread SDK state.
- Other region (public enum=4) encoded `debug_params:[6,4]`. Its HTTP 200 response
  also said not required, but included SDK actions writing `IABTCF_gdprApplies=0`,
  CMP SDK ID 300 and consent-mode settings, plus an about:blank form base URL and
  request-info keys. An opaque pingback URL was redacted in exported logs.
- The wire parameters and response content change with geography. This confirms
  propagation of the client setting into the request, but does not establish the
  server's rule evaluation or the reason no EEA message matched.
- Evidence: `ump-network-comparison.json` (redacted structured pairs),
  `ump-network-eea-decoded-console.log`, `ump-network-other-console.log` and
  `ump-network-build.log`. The first capture represented the anti-XSSI response as
  non-JSON bytes; the subsequent capture parsed it without changing SDK input.
- Next focused step: give Google support the App ID, published message details,
  timestamps and these responses to investigate EEA message eligibility/association
  and backend rule evaluation. App readiness, propagation and account eligibility
  remain hypotheses, not diagnosed causes. The production app was not modified.
