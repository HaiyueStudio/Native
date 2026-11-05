import {Canvas, ImageAsset, ImageBitmap as NativeImageBitmap} from '@nativescript/canvas';
import {createNativeHyaImageHost} from './image-host';
import {acquireNativeBitmapUploads} from './native-bitmap-uploads';

/** Canvas 2.1.18 source contract, pinned in the G11 evidence. Physical iOS validation is still required. */
export const createIosHyaImageHost = (queue: GPUQueue) => {
  let canvas: Canvas | null = null;
  const uploads = acquireNativeBitmapUploads(queue, bitmap => {
    canvas ??= new Canvas(); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d', {willReadFrequently: true});
    if (!context) throw new Error('Native HYA RGBA readback context is unavailable.');
    context.clearRect(0, 0, bitmap.width, bitmap.height);
    context.drawImage(bitmap, 0, 0);
    const data = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  });
  const host = createNativeHyaImageHost({
  async decode(bytes) {
    // The 2.1.18 iOS C++ callback casts its argument to ArrayBuffer, despite the
    // public declaration accepting a typed array. Passing a view crashes V8.
    // Copy the exact view range. The sync path also avoids the wrapper's leaked
    // strong-ref counter (its async decrement expression never decrements a live count).
    const asset = new ImageAsset();
    const encoded = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(encoded).set(bytes);
    const loadEncoded = asset.loadFromEncodedBytesSync as unknown as (bytes: ArrayBuffer) => boolean;
    if (!loadEncoded.call(asset, encoded)) throw new Error('Native HYA image bytes could not be decoded.');
    return uploads.own(await NativeImageBitmap.createFrom(asset, {premultiplyAlpha: 'none', colorSpaceConversion: 'none'}) as ImageBitmap);
  },
  async snapshot(source) {
    if (!(source instanceof Canvas) && !(source instanceof NativeImageBitmap) && !(source instanceof ImageAsset)) {
      throw new TypeError('Native HYA bitmap snapshots require a Canvas, ImageBitmap or ImageAsset.');
    }
    return uploads.own(await NativeImageBitmap.createFrom(source, {premultiplyAlpha: 'premultiply', colorSpaceConversion: 'none'}) as ImageBitmap);
  },
  });
  return {...host, dispose() {uploads.dispose(); if (canvas) {canvas.width = 1; canvas.height = 1; canvas = null;}}};
};
