/** Canvas 2.1.18's Android onSubmittedWorkDone callback crashes in JNI.
 * A mapped readback after a queue submission supplies a real completion fence.
 * Calls in the same JS turn share a fence; completed buffers are reused.
 */
export function installQueueFence(device: GPUDevice): void {
  const queue = device.queue;
  const idle: GPUBuffer[] = [];
  let scheduled: Promise<undefined> | null = null;
  let destroyed = false;
  const destroy = device.destroy.bind(device);
  device.destroy = () => {
    destroyed = true;
    for (const buffer of idle) buffer.destroy();
    idle.length = 0;
    destroy();
  };
  queue.onSubmittedWorkDone = () => {
    if (scheduled) return scheduled;
    scheduled = Promise.resolve().then(async () => {
      scheduled = null;
      if (destroyed) throw new Error('GPU device is destroyed.');
      const buffer = idle.pop() ?? device.createBuffer({ label: 'android-queue-fence', size: 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
      let reusable = false;
      try {
        const encoder = device.createCommandEncoder({ label: 'android-queue-fence' });
        encoder.clearBuffer(buffer, 0, 4);
        queue.submit([encoder.finish()]);
        await buffer.mapAsync(GPUMapMode.READ, 0, 4);
        buffer.unmap();
        reusable = true;
      } finally {
        if (reusable && !destroyed && idle.length < 3) idle.push(buffer);
        else buffer.destroy();
      }
      return undefined;
    });
    return scheduled;
  };
}
