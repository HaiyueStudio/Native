import { requestAnimationFrame, cancelAnimationFrame } from '@nativescript/core/animation-frame';
import { time } from '@nativescript/core/profiling';
import { installNativeAbortRuntime } from './abort-runtime';
import { createFrameScheduler } from './frame-scheduler';

let reportFrameError: (error: unknown) => void = error => console.error(error);
const clock = typeof globalThis.performance?.now === 'function'
  ? globalThis.performance.now.bind(globalThis.performance) : time;
export const nativeFrames = createFrameScheduler({
  request: requestAnimationFrame,
  cancel: cancelAnimationFrame,
  now: clock,
}, error => reportFrameError(error));

/** Only the scheduling globals actually used by Engine; no synthetic DOM. */
export function installNativeFrameRuntime(onError: (error: unknown) => void): void {
  reportFrameError = onError;
  // Core 9.1 leaves this to the runtime; the Canvas-compatible iOS 9.0.3
  // runtime needs Core's existing implementation for Scene asset ownership.
  installNativeAbortRuntime();
  if (typeof globalThis.performance?.now !== 'function') {
    Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: clock } });
  }
  // Core's CommonJS globals are configurable lazy getters without setters.
  // Define our scheduler explicitly instead of assigning to those getters.
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, writable: true, value: (callback: FrameRequestCallback) => nativeFrames.request(callback) });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, writable: true, value: (id: number) => nativeFrames.cancel(id) });
}
