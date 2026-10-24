import type {HyaAudioHost, HyaAudioResource} from '@haiyue/extensions/hya-audio';

type VoiceRequest = Parameters<HyaAudioHost['schedule']>[0];
type NativeVoiceParameters = Omit<VoiceRequest, 'token' | 'value' | 'onEnded'>;
export interface NativeDecodedAudio {
  readonly value: unknown;
  readonly sampleRate: number;
  readonly channels: number;
  readonly frames: number;
  readonly bytes: number;
  release(): void;
}
export interface NativeAudioCompletion {readonly token: number; readonly frame: number; readonly status: 'ok' | 'error';}
/** Native implementation verifies encoded SHA-256 and owns its decoder and PCM handles. */
export interface NativePcmPort {
  readonly sampleRate: number;
  readonly state: HyaAudioHost['state'];
  nowFrame(): number;
  unlock(): Promise<void>;
  decode(resource: HyaAudioResource, bytes: Uint8Array, signal: AbortSignal): Promise<NativeDecodedAudio>;
  schedule(token: number, value: unknown, request: NativeVoiceParameters): void;
  stop(token: number, frame: number): void;
  setGain(token: number, gain: number, frame: number): void;
  setRate(token: number, rate: number, frame: number): void;
  cancel(token: number): void;
  drain(): readonly NativeAudioCompletion[];
}
export interface NativeAudioController {
  readonly host: HyaAudioHost;
  /** Only deliver completed native voices; never advance/sample a HYA timeline here. */
  poll(): number;
  /** Retire this controller's leases/voices. The explicitly borrowed port is not closed. */
  dispose(): void;
}

const maxEncodedBytes = 64 * 1024 * 1024, maxPcmBytes = 256 * 1024 * 1024;
const frame = (value: number) => {if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Native audio requires a nonnegative safe sample frame.'); return value;};
const gain = (value: number) => {if (!Number.isFinite(value) || value < 0) throw new RangeError('Native audio gain must be finite and nonnegative.'); return value;};
const rate = (value: number) => {if (!Number.isFinite(value) || value < .0625 || value > 16) throw new RangeError('Native audio rate is outside the admitted range.'); return value;};
const aborted = (signal: AbortSignal) => {if (signal.aborted) {const error = new Error('Native audio decode was cancelled.'); error.name = 'AbortError'; throw error;}};
const errorsOrThrow = (errors: unknown[]) => {if (errors.length) throw new AggregateError(errors, 'Native audio cleanup/completion failed.');};

interface Domain {
  readonly sampleRate: number;
  readonly native: Pick<NativePcmPort, 'decode' | 'schedule' | 'stop' | 'setGain' | 'setRate' | 'cancel'>;
  readonly voices: Map<number, (completion: NativeAudioCompletion) => void>;
  state(): HyaAudioHost['state']; now(): number; unlock(): Promise<void>; next(): number; poll(): number;
}
const domains = new WeakMap<NativePcmPort, Domain>();
function domainFor(port: NativePcmPort): Domain {
  const previous = domains.get(port); if (previous) return previous;
  if (!port || !Number.isSafeInteger(port.sampleRate) || port.sampleRate <= 0 || port.sampleRate > 384000
      || ['nowFrame', 'unlock', 'decode', 'schedule', 'stop', 'setGain', 'setRate', 'cancel', 'drain'].some(key => typeof port[key as keyof NativePcmPort] !== 'function')) {
    throw new TypeError('Native audio port is incomplete.');
  }
  const native = {decode: port.decode.bind(port), schedule: port.schedule.bind(port), stop: port.stop.bind(port),
    setGain: port.setGain.bind(port), setRate: port.setRate.bind(port), cancel: port.cancel.bind(port)};
  const now = port.nowFrame.bind(port), unlock = port.unlock.bind(port), drain = port.drain.bind(port);
  const voices = new Map<number, (completion: NativeAudioCompletion) => void>();
  let sequence = 0, lastFrame = 0, polling = false;
  const domain: Domain = {
    sampleRate: port.sampleRate, native, voices,
    state() {const state = port.state; if (!['running', 'suspended', 'closed'].includes(state)) throw new TypeError('Invalid native audio state.'); return state;},
    now() {const current = frame(now()); if (current < lastFrame) throw new RangeError('Native audio clock moved backwards.'); lastFrame = current; return current;},
    async unlock() {if (domain.state() === 'closed') throw new Error('Native audio port is closed.'); await unlock(); if (domain.state() !== 'running') throw new Error('Native audio unlock did not start the device.');},
    next() {if (!Number.isSafeInteger(sequence + 1)) throw new RangeError('Native audio voice identity exhausted.'); return ++sequence;},
    poll() {
      if (polling) return 0;
      polling = true; let completed = 0; const errors: unknown[] = [];
      try {
        for (const completion of drain()) {
          try {
            if (!Number.isSafeInteger(completion.token) || completion.token <= 0 || !['ok', 'error'].includes(completion.status)) throw new TypeError('Invalid native audio completion.');
            frame(completion.frame); const finish = voices.get(completion.token); if (!finish) continue;
            voices.delete(completion.token); ++completed;
            if (completion.status === 'error') errors.push(new Error(`Native audio voice ${completion.token} failed.`));
            try {finish(completion);} catch (error) {errors.push(error);}
          } catch (error) {errors.push(error);}
        }
      } finally {polling = false;}
      errorsOrThrow(errors); return completed;
    },
  };
  domain.state(); domain.now(); domains.set(port, domain); return domain;
}

/** Uses only public HYA types. Native PCM remains protected by the platform bridge after lease release. */
export function createNativeHyaAudioHost(port: NativePcmPort, resolve?: HyaAudioHost['resolve']): NativeAudioController {
  const domain = domainFor(port), decoded = new Map<object, NativeDecodedAudio>();
  const voices = new Map<number, () => void>(), publicTokens = new Map<string, number>();
  let disposed = false;
  const live = () => {if (disposed || domain.state() === 'closed') throw new Error('Native HYA audio owner is closed.');};
  const forgetVoice = (id: number, token: string) => {voices.delete(id); domain.voices.delete(id); if (publicTokens.get(token) === id) publicTokens.delete(token);};
  const host: HyaAudioHost = Object.freeze({
    profile: 'sample-accurate' as const,
    get sampleRate() {return domain.sampleRate;},
    get state() {return disposed ? 'closed' as const : domain.state();},
    nowFrame: () => domain.now(), unlock: async () => {live(); await domain.unlock(); live();},
    ...(resolve === undefined ? {} : {resolve}),
    async decode(resource: HyaAudioResource, signal: AbortSignal, encoded: ArrayBuffer) {
      live(); aborted(signal);
      if (!(encoded instanceof ArrayBuffer) || encoded.byteLength > maxEncodedBytes) throw new RangeError('Native encoded audio exceeds the host ceiling.');
      const bytes = resource.frameLength * resource.channels * 4;
      if (!Number.isSafeInteger(resource.frameLength) || resource.frameLength <= 0 || ![1, 2].includes(resource.channels)
          || !Number.isSafeInteger(resource.sampleRate) || resource.sampleRate <= 0 || resource.sampleRate > 384000
          || !Number.isSafeInteger(bytes) || bytes > maxPcmBytes) throw new RangeError('Native PCM metadata is outside the declared mono/stereo host capacity.');
      const result = await domain.native.decode(resource, new Uint8Array(encoded.slice(0)), signal);
      try {
        aborted(signal); live();
        if (!result || typeof result.release !== 'function' || result.frames !== resource.frameLength || result.channels !== resource.channels
            || result.sampleRate !== resource.sampleRate || result.bytes !== bytes) throw new TypeError('Native decoded PCM does not match the declared resource.');
      } catch (error) {if (result && typeof result.release === 'function') result.release(); throw error;}
      const token = Object.freeze({}); decoded.set(token, result);
      return Object.freeze({value: token, sampleRate: result.sampleRate, channels: result.channels, frames: result.frames, bytes: result.bytes,
        release() {if (!decoded.delete(token)) return; result.release();}});
    },
    schedule(request: VoiceRequest) {
      live(); if (domain.state() !== 'running') throw new Error('Native audio requires an explicit successful user-gesture unlock.');
      const value = request.value, buffer = value && typeof value === 'object' ? decoded.get(value) : undefined;
      if (!buffer) throw new TypeError('Native decoded audio belongs to a different or retired owner.');
      if (typeof request.token !== 'string' || !request.token || publicTokens.has(request.token)) throw new TypeError('Native voice token must be nonempty and unique in its owner.');
      frame(request.startFrame); frame(request.offsetFrame); gain(request.gain); rate(request.rate);
      const end = request.stopFrame ?? (request.durationFrames === undefined ? undefined : request.startFrame + frame(request.durationFrames));
      if (end !== undefined && (frame(end) < request.startFrame || request.durationFrames !== undefined && end !== request.startFrame + frame(request.durationFrames))) throw new RangeError('Native voice stop and duration disagree.');
      if (request.offsetFrame >= buffer.frames || request.loop && (frame(request.loop.startFrame) >= frame(request.loop.endFrame)
          || request.loop.endFrame > buffer.frames || request.offsetFrame >= request.loop.endFrame)) throw new RangeError('Native voice source offset or loop range is invalid.');
      if (typeof request.onEnded !== 'function') throw new TypeError('Native voice requires an ended callback.');
      const id = domain.next(), publicToken = request.token;
      let ended = false, callback: (() => void) | undefined = request.onEnded;
      const release = () => {if (ended) return; ended = true; callback = undefined; forgetVoice(id, publicToken); domain.native.cancel(id);};
      voices.set(id, release); publicTokens.set(publicToken, id);
      domain.voices.set(id, () => {if (ended) return; ended = true; forgetVoice(id, publicToken); const notify = callback; callback = undefined; notify?.();});
      const {token: _token, value: _value, onEnded: _onEnded, ...parameters} = request;
      try {domain.native.schedule(id, buffer.value, {...parameters, ...(end === undefined ? {} : {stopFrame: end})});}
      catch (error) {try {release();} catch (cleanup) {throw new AggregateError([error, cleanup], 'Native scheduling and retirement failed.');} throw error;}
      return Object.freeze({
        stop(at?: number) {if (!ended) domain.native.stop(id, frame(at === undefined ? domain.now() : at));},
        setGain(value: number, at?: number) {if (!ended) domain.native.setGain(id, gain(value), frame(at === undefined ? domain.now() : at));},
        setRate(value: number, at?: number) {if (!ended) domain.native.setRate(id, rate(value), frame(at === undefined ? domain.now() : at));},
        release,
      });
    },
  });
  return Object.freeze({host, poll: () => domain.poll(), dispose() {
    if (disposed) return; disposed = true; const errors: unknown[] = [];
    for (const release of [...voices.values()]) {try {release();} catch (error) {errors.push(error);}}
    for (const [token, buffer] of [...decoded]) {decoded.delete(token); try {buffer.release();} catch (error) {errors.push(error);}}
    try {domain.poll();} catch (error) {errors.push(error);} errorsOrThrow(errors);
  }});
}
