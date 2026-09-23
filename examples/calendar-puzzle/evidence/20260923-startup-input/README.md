# Startup calendar / purchase-panel input — 2026-09-23

## Cause and change

Startup UMP initialization previously set reward `busy=true` and acquired the
host presentation pause before requesting consent information. That pause stops
rendering and native touch delivery, even when the server ultimately returns
`notRequired` and no form appears. The network deadline is 20 seconds. A startup
request still pending across background/resume retains its presentation token.
This also blocks Today/Back on a paywall for a saved date that is no longer today.

Startup now refreshes consent information with gameplay/input active. If a free
user requires a consent form, the gateway asks the controller to prepare the
presentation and only then pauses the host. The native `presentConsent` operation
uses the already updated consent information without repeating the query.
Paid users and not-required responses acquire no startup presentation pause.

Explicit ad/privacy requests serialize behind the startup native request, retry
after startup failure, and take precedence over automatic form presentation.
Startup completion cannot clear another operation's busy state or pause token.
Daily allowances, verified purchase/date gates, SDK consent checks and release
debug restrictions remain enforced.

## Validation

- `npm test`: **71/71 passed**, including a pending-startup-request regression
  through the real pointer target, presentation pause, reward controller and game
  navigation methods. Calendar opens before the request resolves; after simulated
  background/resume with yesterday's selected date, Back and Today still work.
  These tests simulate lifecycle/date changes; they are not physical-device taps.
- Tests also cover required-form pause timing, OS resume while a form owns the
  pause, explicit-request overlap, late disposal, network/presentation failures,
  paid startup and purchase-panel navigation during store refresh.
- `npm run typecheck`: passed.
- iOS JavaScript webpack bundle: compiled successfully. The initial sandboxed
  prepare/build could not access CoreSimulator; an approved Xcode build outside
  that restriction succeeded with the existing pinned packages.
- iOS Debug simulator build: **BUILD SUCCEEDED**, x86_64, deployment target 15.0.
  The built bundle includes the new startup path and Swift consent boundary.

Logs: `tests.log`, `typecheck.log`, `ios-simulator-build.log`.
Physical iPhone installation and overnight manual acceptance remain outstanding.

## Additional simulator launch check

Installed into a new isolated iPhone 17 Pro / iOS 26.3.1 simulator named
`Calendar Startup Interaction`, leaving existing simulator/phone saves untouched.
Launched with Debug EEA/reset flags. The journal reached host creation, GPU
adapter selection and surface configuration, but did not record a first frame or
startup UMP completion during observation. This run therefore does **not** verify
live UMP or touch interaction; the runtime launch check remains inconclusive.
No consent choice, ad or purchase was performed. The test simulator was shut down
after capture. Evidence: `simulator-console.log`, `simulator-host.jsonl`.
