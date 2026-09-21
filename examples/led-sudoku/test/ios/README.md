# iOS real-touch regression

`GenerationUITests.swift` drives UIKit with XCTest taps/swipes. It covers Cancel,
difficulty/rule selection, Start dismissing the rules form, visible uniqueness
progress on the board, completion and reopening the rules. Calling NativeScript
`notify({eventName: 'tap'})` alone cannot detect ancestor gesture interception.

Build/install the app into an iOS simulator, then from this example directory:

```sh
bundle exec ruby scripts/create-ui-test-project.rb /tmp/led-uitest-project
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild test \
  -project /tmp/led-uitest-project/SudokuUITests.xcodeproj -scheme SudokuUITests \
  -destination 'platform=iOS Simulator,id=SIMULATOR_ID' \
  -derivedDataPath /tmp/led-uitest-derived-simulator -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-
```

Use the host architecture when building the simulator app. `LED_UI_TEST=1` is
accepted only by Debug builds and uses the existing separate diagnostic save and
preferences mode, without running the scripted smoke suite. Player saves remain
untouched. An on-device XCTest runner is another signed application and may hit
the free developer profile's three-app limit; use a simulator instead of removing
other applications.
