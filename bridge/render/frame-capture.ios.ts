import { File, knownFolders, path } from '@nativescript/core';
import type { Canvas } from '@nativescript/canvas';

/** Opt-in device validation; normal launches do not capture or write images. */
export function isFrameCaptureRequested(): boolean {
  return NSProcessInfo.processInfo.environment.objectForKey('G02_CAPTURE_FRAME') === '1';
}

export function captureSurfaceFrame(view: Canvas, file = 'g02-clear-frame.png'): { file: string; bytes: number } {
  // Canvas routes this to its native WebGPU readback, while the submitted
  // current texture is still acquired and before present releases its handle.
  const url: unknown = view.toDataURL('image/png');
  const prefix = 'data:image/png;base64,';
  if (typeof url !== 'string' || !url.startsWith(prefix)) throw new Error('Native WebGPU PNG readback returned no PNG.');
  // Foundation's zero option means strict decoding; the generated enum omits it.
  const data = NSData.alloc().initWithBase64EncodedStringOptions(url.slice(prefix.length), 0 as NSDataBase64DecodingOptions);
  if (!data?.length) throw new Error('Native WebGPU PNG readback is empty.');
  File.fromPath(path.join(knownFolders.documents().path, file)).writeSync(data, error => { throw error; });
  return { file, bytes: data.length };
}
