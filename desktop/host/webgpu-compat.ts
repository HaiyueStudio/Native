/** Deno 2.9.6 selects the typed-array overload even when its range is omitted. */
export function installWebGpuCompatibility(): () => void {
  const restorers: (() => void)[] = [];
  for (const ctor of [GPURenderPassEncoder, GPUComputePassEncoder, GPURenderBundleEncoder]) {
    const prototype = ctor.prototype as any, original = prototype.setBindGroup;
    prototype.setBindGroup = function (index: number, group: GPUBindGroup, offsets?: Iterable<number>, start?: number, length?: number) {
      if (offsets instanceof Uint32Array && start === undefined) return original.call(this, index, group, offsets, 0, offsets.length);
      if (start === undefined) return offsets === undefined ? original.call(this, index, group) : original.call(this, index, group, offsets);
      return original.call(this, index, group, offsets, start, length);
    };
    restorers.push(() => { prototype.setBindGroup = original; });
  }
  return () => restorers.forEach(restore => restore());
}
