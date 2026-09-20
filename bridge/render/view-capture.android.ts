import { ImageSource, knownFolders, path, type View } from '@nativescript/core';

export function captureNativeView(view: View, filename: string): void {
  const native = view.nativeViewProtected as android.view.View;
  if (!native || native.getWidth() <= 0 || native.getHeight() <= 0) throw new Error('View is not laid out.');
  const bitmap = android.graphics.Bitmap.createBitmap(native.getWidth(), native.getHeight(), android.graphics.Bitmap.Config.ARGB_8888);
  try {
    native.draw(new android.graphics.Canvas(bitmap));
    if (!new ImageSource(bitmap).saveToFile(path.join(knownFolders.documents().path, filename), 'png')) throw new Error('View capture failed.');
  } finally { bitmap.recycle(); }
}
