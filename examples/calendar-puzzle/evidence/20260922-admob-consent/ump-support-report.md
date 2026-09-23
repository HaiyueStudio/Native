# Draft: Published GDPR message returns NOT_REQUIRED in EEA simulator

Prepared for Google Mobile Ads / UMP support; not submitted.

Our published AdMob European regulations message does not appear in EEA testing.
The consent-info request succeeds and returns NOT_REQUIRED, with no available form.

Configuration:

- AdMob App ID: `ca-app-pub-2053256758816744~9316994454`
- iOS bundle ID: `org.haiyue.games.calendarpuzzle`
- UMP runtime version: 3.1.0
- Message: `Calendar Puzzle iOS GDPR`; console shows published/enabled, associated with the iOS app, EEA + UK + Switzerland targeting.
- Commonly used ad partners enabled; console shows 198 partners.
- App is not yet linked to a public App Store listing and shows readiness review required. We do not know whether this is relevant to the UMP response.

Reproduction:

1. Fresh iPhone 17 Pro simulator, iOS 26.3.1 (23D8133), x86_64.
2. Minimal UIKit app with only UMP 3.1.0 and system frameworks; same App ID and bundle ID as production.
3. Reset UMP consent information.
4. Set `tagForUnderAgeOfConsent = NO` and `debugSettings.geography = UMPDebugGeographyEEA`. Simulators automatically qualify as test devices.
5. Call `requestConsentInfoUpdateWithParameters` from the main thread, with the controller attached and application active.
6. On success, call `loadAndPresentIfRequiredFromViewController`.

Observed on 2026-09-22 at 20:45:40 Asia/Shanghai (12:45:40 UTC):

```text
reset: consent=0 form=0 privacy=0 canRequestAds=false
parameters: simulator=true geography=1 underAge=false
updated (3140 ms): consent=2 form=2 privacy=2 canRequestAds=true
completed (3173 ms): consent=2 form=2 privacy=2 canRequestAds=true
```

No network or form error is returned. No consent form is presented. The same result
also occurs in the full game on simulator and on a registered physical test device
with EEA debugging. The minimal app removes game logic, NativeScript, purchases,
Mobile Ads initialization and reward handling from the reproduction.

Could you check why this App ID receives NOT_REQUIRED / UNAVAILABLE for an EEA
debug request despite a published European regulations message? Please also clarify
whether any account/message eligibility condition is preventing delivery, and whether
there is a known UMP 3.1.0 issue affecting this test configuration.

Local attachments available: minimal native source and build script,
`minimal-native-eea-console.log`, `minimal-native-eea.png`.

## Additional SDK-version isolation

On 2026-09-22, the exact same minimal source was built separately against official
UMP 3.0.0 and 3.1.0 archives, with SHA-256 matching their version-tagged Google
Swift Package manifests. Both apps ran sequentially on the same dedicated iOS
simulator, same bundle/App ID, reset state, EEA debug geography, under-age false,
and unchanged network configuration. Actual runtime versions were logged.

- 3.0.0, 21:01:10 Asia/Shanghai: update succeeded in 1,839 ms, consent=2, form=2,
  privacy=2, canRequestAds=true; no form or error.
- 3.1.0, 21:02:24 Asia/Shanghai: update succeeded in 931 ms, consent=2, form=2,
  privacy=2, canRequestAds=true; no form or error.

Reverting the isolated example to 3.0.0 did not resolve the issue. This is not
specific to 3.1.0 in this test. Logs: `ump-3.0.0-eea-console.log` and
`ump-3.1.0-eea-console.log`.

## Actual UMP network exchange

We added an opt-in observer at the native URLSession request/completion boundary
of the isolated simulator probe. It preserves the original request and response,
uses normal HTTPS validation and does not replay or synthesize data.

At 2026-09-22 13:20:15 UTC, UMP 3.1.0 sent a POST to
`https://fundingchoicesmessages.google.com/a/consent`, including:

```json
{
  "admob_app_id": "ca-app-pub-2053256758816744~9316994454",
  "app_info": {"package_name": "org.haiyue.games.calendarpuzzle"},
  "sdk_info": {"version": "3.1.0"},
  "debug_params": [2, 4],
  "tag_for_under_age_of_consent": false,
  "language_code": "zh-Hans-CN"
}
```

The request above is an excerpt; the full redacted request is attached. HTTP 200
returned an anti-XSSI prefix followed by exactly this JSON:

```json
{"consent_signal":"CONSENT_SIGNAL_NOT_REQUIRED","privacy_options_required":"NOT_REQUIRED"}
```

A reset + Other-region control encoded `debug_params:[6,4]`. It also received
HTTP 200 / NOT_REQUIRED, but additionally contained actions setting
`IABTCF_gdprApplies=0`, CMP SDK ID 300, consent-mode settings, and request-info keys.
This shows that geography changes propagate into actual wire requests and that
the response content differs. The EEA response provides no reason or form payload.

Could you investigate the EEA-specific message association/eligibility and the
server-side decision for this App ID? Attached local evidence:
`ump-network-comparison.json`, `ump-network-eea-decoded-console.log`,
`ump-network-other-console.log`. Stored consent values and opaque pingback URL
tokens are redacted. No report has been submitted automatically.
