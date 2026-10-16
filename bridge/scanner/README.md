# QR scanning

Import `scanCode` and `cancelScan` from `@haiyue/native/scanner`. `scanCode({prompt, cancelLabel, maxTextLength})` returns `{text, format: 'qr'}`, `null` on cancellation, and rejects permission/configuration/oversize errors. Concurrent scans are rejected. The module never opens URLs or interprets the text. Validate application payloads separately before applying them.

- iOS: AVFoundation, on-demand camera permission. Add `NSCameraUsageDescription` to the app's Info.plist. Camera capture stops when the scanner closes.
- Android: add `implementation 'com.journeyapps:zxing-android-embedded:4.3.0'` to `app.gradle` and `android.permission.CAMERA` to the manifest. The embedded CaptureActivity handles permission and lifecycle; scanning works offline without Google Play Services. QR only; barcode images are not retained.

Call `cancelScan()` when disposing the owning game. No permission is requested on app startup. Permission denial is an error; cancellation does not import anything. The default text bound is 8192 characters, configurable up to 1,000,000.

Implementation references: [ZXing Embedded 4.3.0](https://github.com/journeyapps/zxing-android-embedded/tree/v4.3.0), [AVFoundation camera authorization](https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media). Android requires API 24+ with the default ZXing core dependency. Its system Back button cancels the scan; `cancelLabel` currently applies to iOS.

`scanCode({source: 'photos'})` selects one image with the system picker and decodes
QR codes offline. Omitting `source` keeps camera scanning. Both sources share the
concurrency guard, text limit and `cancelScan()` lifecycle. Photo cancellation
returns `null`; no code, multiple distinct codes and unreadable/oversized images
reject without returning a payload. Images are temporary and never uploaded.

On iOS (14+), link PhotosUI and CoreImage (`OTHER_LDFLAGS = $(inherited) -framework PhotosUI -framework CoreImage`). PHPicker gives access only to the selected image, so reading QR photos needs no broad Photos permission or photo-library usage description. Camera scanning still needs its separate permission. On Android, ACTION_GET_CONTENT grants a temporary selected-image URI; no storage permission is added. Images over 64 megapixels are rejected and decoder resolution is bounded (4096 on iOS, 2048 on Android).
