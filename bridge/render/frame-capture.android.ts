import { knownFolders, path } from '@nativescript/core';
import type { Canvas } from '@nativescript/canvas';
import { nativeLaunchFlag } from '../lifecycle/launch-flags';
export function isFrameCaptureRequested(): boolean { return nativeLaunchFlag('G02_CAPTURE_FRAME'); }
export function captureSurfaceFrame(view: Canvas, file = 'g02-clear-frame.png'): { file: string; bytes: number } {
  const url: unknown = view.toDataURL('image/png'), prefix = 'data:image/png;base64,';
  if (typeof url !== 'string' || !url.startsWith(prefix)) throw new Error('Native WebGPU PNG readback returned no PNG.');
  const bytes = android.util.Base64.decode(url.slice(prefix.length), android.util.Base64.DEFAULT);
  const stream = new java.io.FileOutputStream(path.join(knownFolders.documents().path, file));
  try { stream.write(bytes); } finally { stream.close(); }
  return { file, bytes: bytes.length };
}
