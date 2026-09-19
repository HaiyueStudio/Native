import test from 'node:test';
import assert from 'node:assert/strict';
import { assertOrientationSupported, orientationMask, orientationPlistValues } from '../../../bridge/display/orientation-policy.ts';
test('portrait, landscape and flexible App masks match UIKit and plist', () => {
  assert.equal(orientationMask('portrait'), 2);
  assert.equal(orientationMask('landscape'), 24);
  assert.equal(orientationMask('any'), 26);
  assert.deepEqual(orientationPlistValues('landscape'), ['UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight']);
  assert.equal(orientationPlistValues('any').length, 3);
  assert.throws(() => orientationMask('invalid'));
});
test('runtime policy can narrow but cannot exceed packaged orientations', () => {
  for (const supported of ['portrait', 'landscape', 'any']) {
    for (const policy of ['portrait', 'landscape', 'any']) {
      if (supported === 'any' || supported === policy) assert.doesNotThrow(() => assertOrientationSupported(policy, supported));
      else assert.throws(() => assertOrientationSupported(policy, supported));
    }
  }
});
