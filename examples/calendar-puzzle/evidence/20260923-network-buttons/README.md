# Network-button interaction — 2026-09-23

## Behavior

- Purchase, restore, store reconnect, rewarded ad and ad privacy actions have a
  400 ms leading-edge debounce. The first tap runs immediately; later taps are
  never queued or replayed. Controllers also serialize in-flight operations.
- Store-dependent buttons begin disabled with animated teal loading dots.
  Reward/privacy controls expose startup prerequisite loading separately from
  the game-wide busy state. Local calendar navigation and purchase-panel Today /
  Back remain available during background initialization.
- Only the active action continues loading after initialization. Completion,
  cancellation or failure removes its spinner; pending payment is a disabled
  state with explanatory text, not an endless loading animation.
- Loading indicators use the existing GUI shapes and demand-render loop: no
  animation timers, texture churn, or frames requested by hidden loading panels.
  Language changes preserve loading indicators.
- Store refresh publishes busy state synchronously. Duplicate explicit refresh
  taps coalesce without scheduling another refresh; real store-change callbacks
  still schedule entitlement reconciliation.
- Both native ad adapters keep game rendering active during network requests.
  Loaded consent/ad surfaces request a presentation pause, await the JS
  acknowledgement, then display. Closing consent releases the pause while the
  ad downloads. Network deadlines do not time out a visible form or ad.

## Verification

- Native Calendar Puzzle: **78/78 tests passed**, TypeScript check passed.
- Games Calendar Puzzle focused suite: **46/46 tests passed**; Games TypeScript
  check passed.
- Browser/WebGPU: **4/4 scenarios passed** using the actual game GUI, button hit
  testing and renderer. Covered Chinese startup and purchase loading, German ad
  loading, and Japanese privacy loading / language change. Repeated taps produced
  one fake-service call and indicator colors changed over consecutive frames.
  All four screenshots were visually inspected.
- Browser fixtures deliberately use controlled service responses: these are UI
  regressions, not real AdMob or store transactions.
- iOS Debug simulator build: **BUILD SUCCEEDED** with final JavaScript bundle,
  Swift consent loading and presentation acknowledgement changes.
- Android: offline `:app:compileDebugJavaWithJavac` passed against the pinned
  Google SDKs. This is Java compilation, not a complete APK/device run.
- Games full `npm run build` and final Calendar Puzzle target build passed.
- Full Games tests: **1,239 passed, 13 failed, 20 skipped**. Failures are in
  Boxbound/Parabox, Mugen and the manifest storage assertion; the full suite is not
  reported as passing.

Browser runner: `Games/scripts/verify-calendar-network.mjs`.
Screenshots and source-fingerprinted browser results:
`Games/.artifacts/calendar-network/{startup,purchase,ad,privacy}.{png,json}`.

No physical-device installation, real purchase, ad completion, or real UMP
consent choice was performed for this change. Native SDK runtime acceptance on a
phone remains outstanding.
