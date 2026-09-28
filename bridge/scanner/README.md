# QR scanning

Import `scanCode` and `cancelScan` from `@haiyue/native/scanner`. `scanCode({prompt, cancelLabel, maxTextLength})` returns `{text, format: 'qr'}`, `null` on cancellation, and rejects permission/configuration/oversize errors. Concurrent scans are rejected. The module never opens URLs or interprets the text. Validate application payloads separately before applying them.

- iOS: AVFoundation, on-demand camera permission. Add `NSCameraUsageDescription` to the app's Info.plist. Camera capture stops when the scanner closes.
- Android: add `implementation 'com.journeyapps:zxing-android-embedded:4.3.0'` to `app.gradle` and `android.permission.CAMERA` to the manifest. The embedded CaptureActivity handles permission and lifecycle; scanning works offline without Google Play Services. QR only; barcode images are not retained.

Call `cancelScan()` when disposing the owning game. No permission is requested on app startup. Permission denial is an error; cancellation does not import anything. The default text bound is 8192 characters, configurable up to 1,000,000.

Implementation references: [ZXing Embedded 4.3.0](https://github.com/journeyapps/zxing-android-embedded/tree/v4.3.0), [AVFoundation camera authorization](https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media). Android requires API 24+ with the default ZXing core dependency. Its system Back button cancels the scan; `cancelLabel` currently applies to iOS.
