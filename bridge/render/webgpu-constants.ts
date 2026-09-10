/** Canvas 2.1.x omits GPUColorWrite; expose the standard WebGPU bitmask once. */
export function installNativeWebGpuConstants(target: object = globalThis): void {
  if ('GPUColorWrite' in target) return;
  Object.defineProperty(target, 'GPUColorWrite', { configurable: true, value: Object.freeze({ RED: 1, GREEN: 2, BLUE: 4, ALPHA: 8, ALL: 15 }) });
}
