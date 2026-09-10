/** Supply the structured clone operation used by Engine's save service on older native runtimes. */
export function installNativeSaveRuntime(clone: typeof structuredClone): void {
  if (typeof globalThis.structuredClone !== 'function') {
    Object.defineProperty(globalThis, 'structuredClone', { configurable: true, writable: true, value: clone });
  }
}
