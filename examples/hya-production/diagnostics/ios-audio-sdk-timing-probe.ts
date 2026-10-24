import {AudioBuffer, OfflineAudioContext, type AudioNode} from '@nativescript/audio-context';
import {runHyaAudioTimingProbe, type AudioProbeGraph, type AudioProbeSource} from '../src/audio-timing-probe';

/** Diagnostic only. Version 1.3.3 is expected to FAIL the timing contract; never use it as admission. */
export const probeIosHyaAudioTiming = () => runHyaAudioTimingProbe((sampleRate, frames): AudioProbeGraph => {
  const context = new OfflineAudioContext(1, frames, sampleRate);
  return {
    destination: context.destination,
    buffer(pcm) {
      const buffer = new AudioBuffer({numberOfChannels: 1, length: pcm.length, sampleRate});
      buffer.copyToChannel(pcm, 0); return buffer;
    },
    source() {
      const source = context.createBufferSource(), rate = source.playbackRate;
      if (!rate) throw new Error('Native audio source has no playbackRate parameter.');
      const endpoints = source as unknown as {loopStart: number; loopEnd: number};
      const endpoint = (key: 'loopStart' | 'loopEnd', value?: number) => {
        if (!(key in source)) throw new Error(`Native audio source does not expose ${key}.`);
        if (value !== undefined) endpoints[key] = value;
        return endpoints[key];
      };
      const wrapper: AudioProbeSource = {
        get buffer() {return source.buffer;}, set buffer(value) {source.buffer = value as AudioBuffer;},
        get loop() {return source.loop;}, set loop(value) {source.loop = value;},
        get loopStart() {return endpoint('loopStart');}, set loopStart(value) {endpoint('loopStart', value);},
        get loopEnd() {return endpoint('loopEnd');}, set loopEnd(value) {endpoint('loopEnd', value);},
        playbackRate: rate,
        start: (when, offset, duration) => source.start(when, offset, duration),
        stop: when => source.stop(when),
        connect: destination => {source.connect(destination as AudioNode);},
        disconnect: () => source.disconnect(),
      };
      return wrapper;
    },
    gain() {
      const gain = context.createGain();
      return {value: gain, gain: gain.gain, connect: destination => {gain.connect(destination as AudioNode);}, disconnect: () => gain.disconnect()};
    },
    async render() {
      const buffer = await context.startRendering(), pcm = buffer.getChannelData(0);
      if (!pcm) throw new Error('Native offline renderer returned no PCM channel.');
      return pcm.slice();
    },
  };
});
