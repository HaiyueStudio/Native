/** Scoped fallback for owned HYA bitmaps; Canvas 2.1.18's asset-copy row layout fails for small images. */
export function acquireNativeBitmapUploads(queue: GPUQueue, readPixels: (bitmap: ImageBitmap) => Uint8Array) {
  const owned = new WeakSet<object>();
  const original = queue.copyExternalImageToTexture;
  const previous = Object.getOwnPropertyDescriptor(queue, 'copyExternalImageToTexture');
  let disposed = false;
  const copy: GPUQueue['copyExternalImageToTexture'] = (source, destination, size) => {
    if (!owned.has(source.source)) {original.call(queue, source, destination, size); return;}
    if (disposed) throw new Error('Native HYA image upload scope is closed.');
    const bitmap = source.source as ImageBitmap;
    const extent = Array.isArray(size) ? size : [(size as GPUExtent3DDict).width, (size as GPUExtent3DDict).height ?? 1, (size as GPUExtent3DDict).depthOrArrayLayers ?? 1];
    const origin = source.origin as GPUOrigin2DDict | readonly number[] | undefined;
    const x = Array.isArray(origin) ? origin[0] ?? 0 : (origin as GPUOrigin2DDict | undefined)?.x ?? 0;
    const y = Array.isArray(origin) ? origin[1] ?? 0 : (origin as GPUOrigin2DDict | undefined)?.y ?? 0;
    // Engine's HYA owner uploads complete bitmaps. Reject an expanded contract explicitly.
    if (x !== 0 || y !== 0 || source.flipY || extent[0] !== bitmap.width || (extent[1] ?? 1) !== bitmap.height || (extent[2] ?? 1) !== 1) throw new Error('Native HYA image upload requires an unflipped complete bitmap.');
    if (!['rgba8unorm', 'rgba8unorm-srgb', 'bgra8unorm', 'bgra8unorm-srgb'].includes(destination.texture.format) || destination.colorSpace && destination.colorSpace !== 'srgb') throw new Error('Native HYA image upload requires an sRGB RGBA8/BGRA8 destination.');
    const pixels = readPixels(bitmap).slice();
    if (pixels.byteLength !== bitmap.width * bitmap.height * 4) throw new Error('Native HYA RGBA readback length mismatch.');
    const bgra = destination.texture.format.startsWith('bgra');
    for (let i = 0; i < pixels.length; i += 4) {
      if (destination.premultipliedAlpha) for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(pixels[i + c]! * pixels[i + 3]! / 255);
      if (bgra) {const red = pixels[i]!; pixels[i] = pixels[i + 2]!; pixels[i + 2] = red;}
    }
    queue.writeTexture(destination, pixels, {bytesPerRow: bitmap.width * 4, rowsPerImage: bitmap.height}, [bitmap.width, bitmap.height, 1]);
  };
  Object.defineProperty(queue, 'copyExternalImageToTexture', {value: copy, configurable: true, writable: true});
  return {
    own<T extends ImageBitmap>(bitmap: T): T {if (disposed) {bitmap.close(); throw new Error('Native HYA image upload scope is closed.');} owned.add(bitmap); return bitmap;},
    dispose() {
      if (disposed) return; disposed = true;
      if (Object.getOwnPropertyDescriptor(queue, 'copyExternalImageToTexture')?.value !== copy) return;
      if (previous) Object.defineProperty(queue, 'copyExternalImageToTexture', previous);
      else Reflect.deleteProperty(queue, 'copyExternalImageToTexture');
    },
  };
}
