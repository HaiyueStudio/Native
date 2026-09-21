import { Application, File, knownFolders, path, type Page } from '@nativescript/core';
/** Explicit debug smoke only; captures this application's window, never other apps. */
export function captureDiagnostics(_page: Page, filename = 'led-sudoku-screen.png'): unknown {
  const window = Application.ios.window;
  UIGraphicsBeginImageContextWithOptions(window.bounds.size, false, 2);
  try {
    window.drawViewHierarchyInRectAfterScreenUpdates(window.bounds, true);
    const image = UIGraphicsGetImageFromCurrentImageContext();
    const data = image && UIImagePNGRepresentation(image);
    if (!data) throw new Error('Native window capture returned no image.');
    File.fromPath(path.join(knownFolders.documents().path, filename)).writeSync(data, error => { throw error; });
    return { file:filename, width:window.bounds.size.width, height:window.bounds.size.height, safeArea:{top:window.safeAreaInsets.top,bottom:window.safeAreaInsets.bottom}, bytes:data.length };
  } finally { UIGraphicsEndImageContext(); }
}
