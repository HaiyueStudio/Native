import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
test('Sky Strike has a distinct app identity and portrait-only packaged orientations', () => {
  const policy = JSON.parse(readFileSync(new URL('../orientation.json', import.meta.url), 'utf8'));
  assert.deepEqual(policy, { supported: 'portrait', initial: 'portrait' });
  const plist = JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', new URL('../App_Resources/iOS/Info.plist', import.meta.url).pathname], { encoding: 'utf8' }));
  assert.deepEqual(plist.UISupportedInterfaceOrientations, ['UIInterfaceOrientationPortrait']);
  assert.equal(plist.CFBundleDisplayName, 'Sky Strike');
  assert.match(readFileSync(new URL('../nativescript.config.ts', import.meta.url), 'utf8'), /org\.haiyue\.native\.skystrike/);
});
