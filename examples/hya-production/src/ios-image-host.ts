import {Canvas, ImageAsset, ImageBitmap as NativeImageBitmap} from '@nativescript/canvas';
import {createNativeHyaImageHost} from './image-host';

/** Canvas 2.1.18 source contract, pinned in the G11 evidence. Physical iOS validation is still required. */
export const createIosHyaImageHost = () => createNativeHyaImageHost({
  async decode(bytes) {
    // 2.1.18 does not recognize a Uint8Array in ImageBitmap.createFrom. ImageAsset's
    // encoded-byte API also avoids its unguarded global Blob check on this path.
    const asset = new ImageAsset();
    if (!await asset.loadFromEncodedBytes(bytes)) throw new Error('Native HYA image bytes could not be decoded.');
    return await NativeImageBitmap.createFrom(asset, {premultiplyAlpha: 'none', colorSpaceConversion: 'none'}) as ImageBitmap;
  },
  async snapshot(source) {
    if (!(source instanceof Canvas) && !(source instanceof NativeImageBitmap) && !(source instanceof ImageAsset)) {
      throw new TypeError('Native HYA bitmap snapshots require a Canvas, ImageBitmap or ImageAsset.');
    }
    return await NativeImageBitmap.createFrom(source, {premultiplyAlpha: 'premultiply', colorSpaceConversion: 'none'}) as ImageBitmap;
  },
});
