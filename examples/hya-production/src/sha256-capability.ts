/** Application-owned, SHA-256-only capability for runtimes without subtle.digest. No random/sign/encrypt API is claimed. */
export function acquireSha256Digest(scope: object, nativeDigest: (bytes: Uint8Array) => Uint8Array): () => void {
  const runtime = scope as {crypto?: {subtle?: {digest?: unknown}}};
  if (typeof runtime.crypto?.subtle?.digest === 'function') return () => {};
  const digest = async (algorithm: AlgorithmIdentifier, input: BufferSource): Promise<ArrayBuffer> => {
    const name = typeof algorithm === 'string' ? algorithm : algorithm?.name;
    if (typeof name !== 'string' || name.toUpperCase() !== 'SHA-256') throw new TypeError('Native application digest supports SHA-256 only.');
    if (!(input instanceof ArrayBuffer) && !ArrayBuffer.isView(input)) throw new TypeError('Digest requires an ArrayBuffer or byte view.');
    const view = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    if (view.byteLength > 64 * 1024 * 1024) throw new RangeError('Native application digest input exceeds 64 MiB.');
    const result = nativeDigest(new Uint8Array(view));
    if (!(result instanceof Uint8Array) || result.byteLength !== 32) throw new Error('Native SHA-256 returned an invalid digest.');
    return new Uint8Array(result).buffer;
  };
  const owner = runtime.crypto?.subtle ?? runtime.crypto ?? scope;
  const key = runtime.crypto?.subtle ? 'digest' : runtime.crypto ? 'subtle' : 'crypto';
  const value = key === 'digest' ? digest : key === 'subtle' ? Object.freeze({digest}) : Object.freeze({subtle: Object.freeze({digest})});
  const original = Object.getOwnPropertyDescriptor(owner, key);
  Object.defineProperty(owner, key, {value, configurable: true, writable: false, enumerable: true});
  let released = false;
  return () => {
    if (released) return; released = true;
    if (Object.getOwnPropertyDescriptor(owner, key)?.value !== value) return;
    if (original) Object.defineProperty(owner, key, original); else Reflect.deleteProperty(owner, key);
  };
}
