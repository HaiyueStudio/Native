import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameScheduler } from '../../../bridge/lifecycle/frame-scheduler.ts';

function setup() {
  const callbacks = [], cancelled = [], errors = [];
  const scheduler = createFrameScheduler({ request: cb => callbacks.push(cb) - 1, cancel: id => cancelled.push(id), now: () => 25 }, error => errors.push(error));
  return { scheduler, callbacks, cancelled, errors };
}

test('native handle zero cancels and a stale callback cannot fire', () => {
  const { scheduler, callbacks, cancelled } = setup();
  const id = scheduler.request(() => assert.fail('cancelled frame ran'));
  assert.ok(id > 0);
  scheduler.cancel(id);
  callbacks[0](1234);
  assert.deepEqual(cancelled, [0]);
  assert.equal(scheduler.pendingCount, 0);
});

test('callbacks use the engine clock and can schedule exactly one following frame', () => {
  const { scheduler, callbacks } = setup();
  scheduler.request(time => {
    assert.equal(time, 25);
    scheduler.request(() => {});
  });
  callbacks[0](987654);
  assert.equal(scheduler.pendingCount, 1);
  scheduler.cancelAll();
  assert.equal(scheduler.pendingCount, 0);
});

test('native callbacks report errors to the host and release their handle', () => {
  const { scheduler, callbacks, errors } = setup();
  const error = new Error('GPU failed');
  scheduler.request(() => { throw error; });
  callbacks[0](0);
  assert.deepEqual(errors, [error]);
  assert.equal(scheduler.pendingCount, 0);
});
