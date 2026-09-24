import { isAndroid } from '@nativescript/core';
/** Copy packaged binary data into a JS-owned ArrayBuffer on either native platform. */
export function readNativeBytes(file: string): ArrayBuffer {
  if (isAndroid) {
    const stream = new java.io.FileInputStream(file);
    try {
      const channel = stream.getChannel();
      const buffer = java.nio.ByteBuffer.allocateDirect(Number(channel.size()));
      while (buffer.hasRemaining()) if (channel.read(buffer) < 0) throw new Error(`Truncated resource: ${file}`);
      buffer.rewind();
      // NativeScript's direct-buffer bridge avoids millions of boxed per-byte JNI calls.
      return (ArrayBuffer as unknown as { from(value: java.nio.ByteBuffer): ArrayBuffer }).from(buffer).slice(0);
    } finally { stream.close(); }
  }
  const data = NSData.dataWithContentsOfFile(file);
  if (!data) throw new Error(`Missing bundled resource: ${file}`);
  return interop.bufferFromData(data).slice(0);
}
