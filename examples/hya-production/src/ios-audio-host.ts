import {createNativeHyaAudioHost, type NativeAudioController, type NativePcmPort, type NativeDecodedAudio} from './audio-host';
import {encodeBase64, decodeBase64} from './bytes-base64';
import type {HyaAudioHost} from '@haiyue/extensions/hya-audio';

interface NativeBuffer {readonly sampleRate: number; readonly channels: number; readonly frames: number; readonly bytes: number; releasePCM(): void;}
interface NativeInstance {
  readonly sampleRate: number; readonly nowFrame: number; readonly pendingVoices: number;
  readonly state: 'running' | 'suspended' | 'closed'; readonly lastError: string;
  unlock(): boolean; suspend(): boolean; close(): boolean;
  decodeBase64MetadataJSONCompletion(encoded: string, metadata: string, completion: (value: NativeBuffer | null, error: {localizedDescription: string} | null) => void): void;
  scheduleBufferTokenRequestJSON(buffer: NativeBuffer, token: number, request: string): number;
  stopTokenAtFrame(token: number, frame: number): number;
  gainTokenValueAtFrame(token: number, value: number, frame: number): number;
  rateTokenValueAtFrame(token: number, value: number, frame: number): number;
  cancelToken(token: number): number; drainCompletions(): string; renderOffline(frames: number): string | null;
}
// Describes the ObjC header/selector boundary only. Actual SDK metadata generation is still required.
declare const HYANativeAudio: {alloc(): {initWithSampleRateOffline(rate: number, offline: boolean): NativeInstance}};
export interface IosHyaAudioController extends NativeAudioController {
  suspend(): void;
  /** Device probe only: actual AVAudioEngine manual/offline interleaved stereo samples. */
  renderOfflineFrames(frames: number): Float32Array;
  readonly fault: unknown;
}

export function createIosHyaAudioHost(options: Readonly<{sampleRate?: number; offline?: boolean; resolve?: HyaAudioHost['resolve']}> = {}): IosHyaAudioController {
  if (typeof HYANativeAudio === 'undefined') throw new Error('HYANativeAudio module metadata is unavailable. Prepare native headers and rebuild the iOS app.');
  const native = HYANativeAudio.alloc().initWithSampleRateOffline(options.sampleRate ?? 48000, options.offline ?? false);
  if (native.state === 'closed' || native.lastError) throw new Error(native.lastError || 'Native audio construction failed.');
  let controller: NativeAudioController, disposed = false, timer: ReturnType<typeof setInterval> | undefined, fault: unknown;
  const stopTimer = () => {if (timer !== undefined) {clearInterval(timer); timer = undefined;}};
  const healthy = () => {if (fault) throw fault; if (native.lastError) throw new Error(native.lastError);};
  const check = (status: number, allowRetired = true) => {if (status !== 0 && !(allowRetired && status === 4)) throw new Error(`Native audio command rejected (${status}).`);};
  const ensureTimer = () => {
    if (disposed || options.offline || native.state !== 'running' || native.pendingVoices === 0) {stopTimer(); return;}
    if (timer === undefined) timer = setInterval(() => {try {pump();} catch (error) {fault = error; stopTimer(); native.suspend();}}, 16);
  };
  const pump = () => {healthy(); const result = controller.poll(); ensureTimer(); return result;};
  const port: NativePcmPort = {
    get sampleRate() {return native.sampleRate;}, get state() {healthy(); return native.state;},
    nowFrame() {healthy(); return native.nowFrame;},
    async unlock() {healthy(); if (!native.unlock()) throw new Error(native.lastError || 'Native audio unlock failed.'); ensureTimer();},
    async decode(resource, bytes, signal) {
      healthy(); if (signal.aborted) {const error = new Error('Native decode cancelled.'); error.name = 'AbortError'; throw error;}
      return await new Promise<NativeDecodedAudio>((resolve, reject) => native.decodeBase64MetadataJSONCompletion(encodeBase64(bytes), JSON.stringify(resource), (value, error) => {
        if (error || !value) {reject(new Error(error?.localizedDescription || 'Native decoder returned no PCM.')); return;}
        let released = false;
        resolve({value, sampleRate: value.sampleRate, channels: value.channels, frames: value.frames, bytes: value.bytes,
          release() {if (released) return; released = true; value.releasePCM();}});
      }));
    },
    schedule(token, value, parameters) {healthy(); check(native.scheduleBufferTokenRequestJSON(value as NativeBuffer, token, JSON.stringify(parameters)), false); ensureTimer();},
    stop(token, frame) {healthy(); check(native.stopTokenAtFrame(token, frame));},
    setGain(token, value, frame) {healthy(); check(native.gainTokenValueAtFrame(token, value, frame));},
    setRate(token, value, frame) {healthy(); check(native.rateTokenValueAtFrame(token, value, frame));},
    cancel(token) {check(native.cancelToken(token)); if (native.state === 'suspended') controller.poll(); ensureTimer();},
    drain() {return JSON.parse(native.drainCompletions());},
  };
  controller = createNativeHyaAudioHost(port, options.resolve);
  return Object.freeze({host: controller.host, poll: pump, get fault() {return fault;},
    suspend() {if (disposed) return; stopTimer(); if (!native.suspend()) throw new Error(native.lastError || 'Native suspension failed.'); pump();},
    renderOfflineFrames(frames: number) {
      if (!options.offline || !Number.isSafeInteger(frames) || frames < 0 || frames > 480000) throw new RangeError('Native offline rendering requires a bounded frame count and an offline instance.');
      healthy(); const encoded = native.renderOffline(frames); if (encoded === null) throw new Error(native.lastError || 'Native offline rendering failed.');
      const bytes = decodeBase64(encoded); if (bytes.byteLength !== frames * 2 * 4) throw new Error('Native offline PCM length mismatch.');
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), pcm = new Float32Array(frames * 2);
      for (let index = 0; index < pcm.length; index++) {const sample = view.getFloat32(index * 4, true); if (!Number.isFinite(sample)) throw new Error('Native offline PCM is nonfinite.'); pcm[index] = sample;}
      pump(); return pcm;
    },
    dispose() {
      if (disposed) return; disposed = true; stopTimer(); const errors: unknown[] = [];
      try {controller.dispose();} catch (error) {errors.push(error);}
      try {if (!native.close()) throw new Error(native.lastError || 'Native audio close failed.'); controller.poll();} catch (error) {errors.push(error);}
      if (errors.length) throw new AggregateError(errors, 'iOS HYA audio disposal failed.');
    },
  });
}
