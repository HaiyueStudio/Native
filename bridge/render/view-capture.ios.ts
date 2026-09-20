import { File, knownFolders, path, type View } from '@nativescript/core';

/** Diagnostic-only capture of native overlays, which WebGPU readback excludes. */
export function captureNativeView(view: View, filename: string): void {
  const native = view.nativeViewProtected as UIView;
  if (!native || native.bounds.size.width <= 0 || native.bounds.size.height <= 0) throw new Error('View is not laid out.');
  UIGraphicsBeginImageContextWithOptions(native.bounds.size, false, 2);
  try {
    const context = UIGraphicsGetCurrentContext();
    if (!context) throw new Error('View capture context unavailable.');
    native.layer.renderInContext(context);
    const image = UIGraphicsGetImageFromCurrentImageContext();
    const data = image && UIImagePNGRepresentation(image);
    if (!data) throw new Error('View capture returned no image.');
    File.fromPath(path.join(knownFolders.documents().path, filename)).writeSync(data, error => { throw error; });
  } finally { UIGraphicsEndImageContext(); }
}
