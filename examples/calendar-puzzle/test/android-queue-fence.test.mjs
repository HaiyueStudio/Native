import test from 'node:test';
import assert from 'node:assert/strict';
import { installQueueFence } from '../../../bridge/render/queue-fence.android.ts';
globalThis.GPUBufferUsage = { MAP_READ: 1, COPY_DST: 8 };
globalThis.GPUMapMode = { READ: 1 };
function fixture() {
  const buffers = [], submitted = [];
  const device = {
    queue: { onSubmittedWorkDone() { throw new Error('Broken JNI callback must not be called'); }, submit(commands) { submitted.push(commands); } },
    createBuffer() {
      const buffer = { destroyed: false, unmapped: false, mapAsync() { return new Promise((resolve, reject) => { buffer.complete = resolve; buffer.fail = reject; }); }, unmap() { this.unmapped = true; }, destroy() { this.destroyed = true; } };
      buffers.push(buffer); return buffer;
    },
    createCommandEncoder() { return { clearBuffer(buffer, offset, size) { assert.equal(offset, 0); assert.equal(size, 4); this.buffer = buffer; }, finish() { return this.buffer; } }; },
    destroy() { this.destroyed = true; },
  };
  installQueueFence(device);
  return { device, buffers, submitted };
}
test('Android fence waits for GPU mapping, coalesces a turn, and reuses completed buffers', async () => {
  const { device, buffers, submitted } = fixture();
  const first = device.queue.onSubmittedWorkDone();
  assert.equal(device.queue.onSubmittedWorkDone(), first);
  let complete = false; void first.then(() => { complete = true; });
  await Promise.resolve();
  assert.equal(submitted.length, 1); assert.equal(complete, false);
  buffers[0].complete(); await first;
  assert.equal(complete, true); assert.equal(buffers[0].unmapped, true);
  const next = device.queue.onSubmittedWorkDone(); await Promise.resolve();
  assert.equal(buffers.length, 1); buffers[0].complete(); await next;
  device.destroy(); assert.equal(buffers[0].destroyed, true);
});
test('Later submissions get a separate fence and failed readbacks are retired', async () => {
  const { device, buffers } = fixture();
  const first = device.queue.onSubmittedWorkDone(); await Promise.resolve();
  const second = device.queue.onSubmittedWorkDone(); await Promise.resolve();
  assert.notEqual(first, second); assert.equal(buffers.length, 2);
  const rejected = assert.rejects(second, /device lost/);
  buffers[1].fail(new Error('device lost')); await rejected;
  assert.equal(buffers[1].destroyed, true);
  device.destroy(); buffers[0].complete(); await first;
  assert.equal(buffers[0].destroyed, true);
  await assert.rejects(device.queue.onSubmittedWorkDone(), /destroyed/);
});
