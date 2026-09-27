# Isolated StoreKit integration

This synthetic test host compiles the real Native Swift purchase bridge. Its product IDs and local StoreKit transactions are test-only. No game code, production StoreKit configuration, account, receipt or signing credential is used.

Generate with the locked xcodeproj gem from an existing Native example's Bundler environment:

```
BUNDLE_GEMFILE=examples/ios-pbr-orbit/Gemfile bundle exec ruby test/storekit/generate.rb artifacts/storekit-project
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild test \
  -project artifacts/storekit-project/NativeStoreTests.xcodeproj -scheme NativeStoreTests \
  -destination 'platform=iOS Simulator,id=<dedicated simulator>' \
  -derivedDataPath artifacts/storekit-derived -resultBundlePath artifacts/storekit-result.xcresult \
  -parallel-testing-enabled NO -test-timeouts-enabled YES -maximum-test-execution-time-allowance 60
```

Tests cover buy/restore, verified entitlement recovery after sync failure, cancellation, pending approval, refund, wrong product/type/signature and localized prices. They reset only this host's local transactions. They do not establish Play Billing, App Store Sandbox, TestFlight, real offline/account-switch or rewarded-ad acceptance. These remain the consuming app's device/console acceptance, as agreed for the next game.
