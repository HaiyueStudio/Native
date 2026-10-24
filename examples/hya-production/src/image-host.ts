import type {HyaPlayerOptions} from '@haiyue/extensions/hya-player';

/** Example-owned platform boundary; it does not introduce another image or GPU owner. */
export interface NativeHyaBitmapFactory {
  decode(bytes: Uint8Array): Promise<ImageBitmap>;
  snapshot(source: unknown): Promise<ImageBitmap>;
}

export function createNativeHyaImageHost(factory: NativeHyaBitmapFactory): NonNullable<HyaPlayerOptions['host']['images']> {
  if (!factory || typeof factory.decode !== 'function' || typeof factory.snapshot !== 'function') {
    throw new TypeError('Native HYA images require decode and snapshot factories.');
  }
  const decode = factory.decode.bind(factory), snapshot = factory.snapshot.bind(factory);
  const aborted = (signal: AbortSignal): void => {
    if (signal.aborted) {const error = new Error('Native HYA image work was cancelled.'); error.name = 'AbortError'; throw error;}
  };
  const acquire = async (prepare: () => Promise<ImageBitmap>, signal: AbortSignal) => {
    aborted(signal);
    const value = await prepare();
    if (!value || typeof value.close !== 'function' || !Number.isSafeInteger(value.width) || value.width <= 0
        || !Number.isSafeInteger(value.height) || value.height <= 0 || !Number.isSafeInteger(value.width * value.height * 4)) {
      if (typeof value?.close === 'function') value.close();
      throw new TypeError('Native HYA decoding returned an invalid bitmap.');
    }
    if (signal.aborted) {value.close(); aborted(signal);}
    let released = false;
    return Object.freeze({value, release() {if (released) return; released = true; value.close();}});
  };
  return Object.freeze({
    decode(bytes: Uint8Array, signal: AbortSignal) {return acquire(() => decode(bytes.slice()), signal);},
    snapshot(source: unknown, signal: AbortSignal) {return acquire(() => snapshot(source), signal);},
  });
}
