const installed = new WeakSet<GPUQueue>();

/** Canvas 2.1.18's native writeTexture assumes TypedArray, unlike WebGPU BufferSource. */
export function installNativeTextureUploads(device: GPUDevice): void {
  const queue = device.queue;
  if (installed.has(queue)) return;
  const writeTexture = queue.writeTexture;
  queue.writeTexture = (destination, data, layout, size) => {
    let bytes: Uint8Array;
    if (ArrayBuffer.isView(data)) {
      bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else if (data instanceof ArrayBuffer
        || (typeof SharedArrayBuffer !== 'undefined' && data instanceof SharedArrayBuffer)) {
      bytes = new Uint8Array(data);
    } else {
      throw new TypeError('Native writeTexture requires an ArrayBuffer or an ArrayBuffer view.');
    }
    // No copy: retain the exact view range and the separate WebGPU layout offset.
    writeTexture.call(queue, destination, bytes, layout, size);
  };
  installed.add(queue);
}
