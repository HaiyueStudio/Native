import { requestAnimationFrame, cancelAnimationFrame } from '@nativescript/core/animation-frame';
import { time } from '@nativescript/core/profiling';
import { installNativeAbortRuntime } from './abort-runtime';
import { createFrameScheduler } from './frame-scheduler';

const frameErrorOwners = new Map<symbol, (error: unknown) => void>();
function reportFrameError(error: unknown): void {
  let report: (error: unknown) => void = error => console.error(error);
  for (const owner of frameErrorOwners.values()) report = owner;
  report(error);
}
const clock = typeof globalThis.performance?.now === 'function'
  ? globalThis.performance.now.bind(globalThis.performance) : time;
export const nativeFrames = createFrameScheduler({
  request: requestAnimationFrame,
  cancel: cancelAnimationFrame,
  now: clock,
}, error => reportFrameError(error));
// Keep global functions outside the registration closure: otherwise a global
// scheduling function can share the disposed host's lexical context.
const requestNativeFrame = (callback: FrameRequestCallback) => nativeFrames.request(callback);
const cancelNativeFrame = (id: number) => nativeFrames.cancel(id);

/** Only the scheduling globals actually used by Engine; no synthetic DOM. */
export function installNativeFrameRuntime(onError: (error: unknown) => void): () => void {
  // Core 9.1 leaves this to the runtime; the Canvas-compatible iOS 9.0.3
  // runtime needs Core's existing implementation for Scene asset ownership.
  installNativeAbortRuntime();
  if (typeof globalThis.performance?.now !== 'function') {
    Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: clock } });
  }
  // Core's CommonJS globals are configurable lazy getters without setters.
  // Define our scheduler explicitly instead of assigning to those getters.
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, writable: true, value: requestNativeFrame });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, writable: true, value: cancelNativeFrame });
  const owner = Symbol('native-frame-error-owner');
  frameErrorOwners.set(owner, onError);
  return () => { frameErrorOwners.delete(owner); };
}
