import { AbortController as CoreAbortController, AbortSignal as CoreAbortSignal } from '@nativescript/core/abortcontroller';

/** Core 9.1's fallback predates reason / throwIfAborted, required by Engine extensions. */
export function installNativeAbortRuntime(): void {
  if (typeof globalThis.AbortController === 'function'
      && typeof new globalThis.AbortController().signal.throwIfAborted === 'function') return;
  class NativeAbortController extends CoreAbortController {
    private abortReason: unknown;
    constructor() {
      super();
      Object.defineProperties(this.signal, {
        reason: { configurable: true, get: () => this.abortReason },
        throwIfAborted: { configurable: true, value: () => { if (this.signal.aborted) throw this.abortReason; } },
      });
    }
    abort(reason?: unknown): void {
      if (this.signal.aborted) return;
      if (reason === undefined) { const error = new Error('This operation was aborted'); error.name = 'AbortError'; reason = error; }
      this.abortReason = reason;
      super.abort();
    }
  }
  Object.defineProperty(globalThis, 'AbortController', { configurable: true, value: NativeAbortController });
  Object.defineProperty(globalThis, 'AbortSignal', { configurable: true, value: CoreAbortSignal });
}
