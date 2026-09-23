# Save a generated image to Photos

`savePhoto(canvas, filename)` saves a PNG from an offscreen Canvas2D surface and resolves with `photos` only after the system accepts the image. Import `./save-photo`; NativeScript chooses the platform implementation.

- iOS: add `NSPhotoLibraryAddUsageDescription` to the host's Info.plist. Requests add-only Photos authorization on use, then awaits the Photos change completion handler.
- Android 29+: uses MediaStore with `Pictures/Haiyue` and a pending row, published after the stream closes. Requires no photo library permission. A failed write removes its unfinished row.
- Android 26–28: hosts must declare `WRITE_EXTERNAL_STORAGE` with `maxSdkVersion="28"`. The adapter requests runtime permission before inserting the image.

Permission denial, encoding failures and storage failures reject; the caller must show a localized error. The helper does not request read access to existing photos.
