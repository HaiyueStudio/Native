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

test('AK47 app packages and initially requests landscape only', async () => {
  const { readFileSync } = await import('node:fs');
  const policy = JSON.parse(readFileSync(new URL('../orientation.json', import.meta.url), 'utf8'));
  assert.deepEqual(policy, { supported: 'landscape', initial: 'landscape' });
  const plist = readFileSync(new URL('../App_Resources/iOS/Info.plist', import.meta.url), 'utf8');
  assert.ok(!plist.includes('UIInterfaceOrientationPortrait'));
  const page = readFileSync(new URL('../src/main-page.xml', import.meta.url), 'utf8');
  assert.equal((page.match(/iosOverflowSafeArea="true"/g) ?? []).length, 2);
});
