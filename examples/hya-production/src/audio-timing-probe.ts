/** PCM qualification for a platform audio graph, independent of wall-clock/JS timer timing. */
export interface AudioProbeParam {
  setValueAtTime(value: number, seconds: number): unknown;
  cancelScheduledValues(seconds: number): unknown;
}
export interface AudioProbeSource {
  buffer: unknown;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  playbackRate: AudioProbeParam;
  start(when: number, offset?: number, duration?: number): void;
  stop(when: number): void;
  connect(destination: unknown): void;
  disconnect(): void;
}
export interface AudioProbeGain {
  readonly value: unknown;
  readonly gain: AudioProbeParam;
  connect(destination: unknown): void;
  disconnect(): void;
}
export interface AudioProbeGraph {
  readonly destination: unknown;
  buffer(pcm: Float32Array): unknown;
  source(): AudioProbeSource;
  gain(): AudioProbeGain;
  render(): Promise<Float32Array>;
}
export interface AudioTimingProbeCase {
  readonly id: string;
  readonly passed: boolean;
  readonly maximumSampleError?: number;
  readonly firstMismatch?: number;
  readonly expectedFirstActive?: number;
  readonly observedFirstActive?: number;
  readonly error?: string;
}

/** Passing this probe is necessary, not sufficient for a complete sample-accurate HYA host. */
export async function runHyaAudioTimingProbe(create: (sampleRate: number, frames: number) => AudioProbeGraph | Promise<AudioProbeGraph>) {
  const sampleRate = 48000, frames = 512, cases: AudioTimingProbeCase[] = [];
  type Test = {id: string; start: number; offset: number; stop?: number; duration?: number; rate?: number; gainChange?: number; rateChange?: number; loop?: readonly [number, number]};
  const tests: readonly Test[] = [
    {id: 'scheduled-start-and-source-offset', start: 67, offset: 19, stop: 233},
    {id: 'start-duration-argument', start: 61, offset: 23, duration: 73},
    {id: 'scheduled-stop', start: 31, offset: 0, stop: 173},
    {id: 'scheduled-gain', start: 32, offset: 0, stop: 224, gainChange: 128},
    {id: 'constant-playback-rate', start: 32, offset: 0, stop: 224, rate: 2},
    {id: 'scheduled-playback-rate', start: 32, offset: 0, stop: 224, rateChange: 128},
    {id: 'loop-subrange', start: 37, offset: 11, stop: 241, loop: [19, 47]},
  ];
  for (const test of tests) {
    let source: AudioProbeSource | undefined, gain: AudioProbeGain | undefined;
    try {
      const graph = await create(sampleRate, frames), pcm = new Float32Array(1024), expected = new Float32Array(frames);
      // A positive ramp makes offsets and loop seams observable; all rate samples use integral positions.
      for (let i = 0; i < pcm.length; i++) pcm[i] = (i + 32) / 2048;
      source = graph.source(); gain = graph.gain(); source.buffer = graph.buffer(pcm);
      source.connect(gain.value); gain.connect(graph.destination);
      const initialGain = test.gainChange === undefined ? 1 : .25;
      gain.gain.setValueAtTime(initialGain, 0);
      source.playbackRate.setValueAtTime(test.rate ?? 1, 0);
      if (test.gainChange !== undefined) {
        gain.gain.cancelScheduledValues(test.gainChange / sampleRate);
        gain.gain.setValueAtTime(.75, test.gainChange / sampleRate);
      }
      if (test.rateChange !== undefined) {
        source.playbackRate.cancelScheduledValues(test.rateChange / sampleRate);
        source.playbackRate.setValueAtTime(2, test.rateChange / sampleRate);
      }
      if (test.loop) {
        source.loop = true;
        source.loopStart = test.loop[0] / sampleRate;
        source.loopEnd = test.loop[1] / sampleRate;
      }
      source.start(test.start / sampleRate, test.offset / sampleRate,
        test.duration === undefined ? undefined : test.duration / sampleRate);
      if (test.stop !== undefined) source.stop(test.stop / sampleRate);
      const end = test.stop ?? (test.duration === undefined ? frames : test.start + test.duration);
      for (let frame = test.start; frame < end; frame++) {
        let position = test.offset + (frame - test.start) * (test.rate ?? 1);
        if (test.rateChange !== undefined && frame >= test.rateChange) position += frame - test.rateChange;
        if (test.loop && position >= test.loop[1]) position = test.loop[0] + (position - test.loop[0]) % (test.loop[1] - test.loop[0]);
        const volume = test.gainChange !== undefined && frame >= test.gainChange ? .75 : initialGain;
        expected[frame] = pcm[position]! * volume;
      }
      const actual = await graph.render();
      if (actual.length !== frames) throw new Error(`Expected ${frames} PCM frames; got ${actual.length}.`);
      let maximumSampleError = 0, firstMismatch = -1;
      for (let frame = 0; frame < frames; frame++) {
        const error = Math.abs(actual[frame]! - expected[frame]!);
        if (!Number.isFinite(error)) throw new Error(`Nonfinite PCM sample ${frame}.`);
        maximumSampleError = Math.max(maximumSampleError, error);
        if (firstMismatch < 0 && error > 1e-6) firstMismatch = frame;
      }
      cases.push({id: test.id, passed: firstMismatch < 0, maximumSampleError, firstMismatch,
        expectedFirstActive: test.start, observedFirstActive: actual.findIndex(value => Math.abs(value) > 1e-6)});
    } catch (error) {cases.push({id: test.id, passed: false, error: String(error)});}
    finally {try {source?.disconnect();} catch {} try {gain?.disconnect();} catch {}}
  }
  return Object.freeze({status: cases.every(test => test.passed) ? 'passed-pcm-timing-probe' : 'failed-pcm-timing-probe',
    sampleRate, frames, tolerance: 1e-6, cases: Object.freeze(cases),
    scope: 'Seven deterministic offline PCM timing checks. No realtime clock drift, decode integrity, user gesture, interruption, voice lifetime, physical device or complete HYA host qualification.'});
}
