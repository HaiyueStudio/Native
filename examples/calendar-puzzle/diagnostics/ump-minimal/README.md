# Minimal native UMP isolation

This diagnostic uses UIKit + UserMessagingPlatform only. No NativeScript, game,
reward bridge, Google Mobile Ads initialization, purchases, or ad requests.
It uses the same `org.haiyue.games.calendarpuzzle` bundle identifier and production
AdMob app ID as Calendar Puzzle. **Install only in a dedicated simulator**;
installing in the game simulator would replace its application.

Prerequisite: build Calendar Puzzle for the iOS simulator once so the pinned UMP
framework is available under `platforms/ios/build/Debug-iphonesimulator`.

From the Calendar Puzzle directory:

```sh
node diagnostics/ump-minimal/build.mjs
```

Output defaults to `/tmp/haiyue-ump-minimal/UMPProbe.app`. The build links the same
UMP framework version as the full-game simulator build, with no package fetch.
It uses the host architecture and targets the iOS simulator (not a physical phone).

For SDK-version comparisons, set `UMP_FRAMEWORKS_DIR` to a directory containing
the desired simulator `UserMessagingPlatform.framework`, and pass a separate app
output path as the first argument. This leaves the game dependency lock unchanged.
Obtain SDK archives from the version-tagged Package.swift in Google's
`swift-package-manager-google-user-messaging-platform` repository and verify its
SHA-256 before extraction. Use the same dedicated simulator and app IDs; the
probe resets consent on every launch and logs the actual runtime SDK version.

Install and run using `xcrun simctl install <dedicated-simulator-id> <app-path>` and
`xcrun simctl launch --console <dedicated-simulator-id> org.haiyue.games.calendarpuzzle`.
Set `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` for these commands.

Every launch resets consent state, explicitly sets under-age false and EEA
debug geography, then requests updated consent and invokes
`loadAndPresentIfRequired`. Simulators are UMP test devices without an ID list.
Optional `SIMCTL_CHILD_UMP_PROBE_OTHER=1` uses the SDK's Other region as a control.
No consent choices are made automatically. Request/form states, errors and elapsed
time are logged to `[ump-minimal]` and displayed in a text view.

Results are recorded in `evidence/20260922-admob-consent/README.md`.

## Observe the actual UMP network exchange

Launch the isolated probe with `SIMCTL_CHILD_UMP_PROBE_TRACE=1` to enable
`network-trace.m`. It observes the concrete URLSession class's
`dataTaskWithRequest:completionHandler:` boundary, forwarding the original request
and completion data unchanged. There is no proxy, certificate installation, TLS
bypass, fabricated response or request replay. This code refuses physical-device
compilation and is not part of the game's build.

Google-host requests and their responses are recorded as JSON in the console and
the probe's `Documents/ump-network.jsonl`. Only selected response headers are kept;
cookies, credentials, device identifiers, stored consent data and opaque pingback
URLs are redacted. Non-JSON bodies are represented by byte count; the Google
anti-XSSI prefix is removed only from the logged JSON view, not from SDK input.
Treat the trace as local diagnostic material and review it before sharing.

The observer covers this specific URLSession API; absence of a captured request
would not prove absence of traffic. The current UMP 3.1.0 request was captured
successfully. Use `SIMCTL_CHILD_UMP_PROBE_OTHER=1` for a region control. The SDK's
wire-format numeric `debug_params` are recorded as observed, not assumed to match
the public enum's numeric values.
