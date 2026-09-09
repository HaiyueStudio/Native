import test from 'node:test';
import assert from 'node:assert/strict';
import { copyDeviceDescriptor } from '../../../bridge/render/device-descriptor.ts';

test('Canvas can extend a frozen Engine request without mutating Engine feature policy', () => {
  const original = Object.freeze({
    requiredFeatures: Object.freeze(['depth-clip-control']),
    requiredLimits: Object.freeze({ maxBindGroups: 4 }),
  });
  const native = copyDeviceDescriptor(original);
  native.requiredFeatures.push('texture-adapter-specific-format-features');
  native.requiredLimits.maxBindGroups = 8;
  assert.deepEqual(original.requiredFeatures, ['depth-clip-control']);
  assert.equal(original.requiredLimits.maxBindGroups, 4);
  assert.equal(native.requiredFeatures.length, 2);
});

test('default device requests get independent mutable feature arrays', () => {
  const first = copyDeviceDescriptor();
  first.requiredFeatures.push('texture-adapter-specific-format-features');
  assert.deepEqual(copyDeviceDescriptor().requiredFeatures, []);
  assert.equal('requiredLimits' in first, false);
});
