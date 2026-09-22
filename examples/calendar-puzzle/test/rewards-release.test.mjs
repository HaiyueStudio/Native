import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../scripts/validate-rewards.cjs', import.meta.url), 'utf8');
const publisher = '1234567890123456'; // Synthetic validation fixture, never a runtime ad ID.
function hook({ unit = `ca-app-pub-${publisher}/1234567890`, app = `ca-app-pub-${publisher}~1234567890`, argv = [] } = {}) {
  const module = { exports: {} }, reads = [];
  runInNewContext(source, { module, __dirname: '/fixture/scripts', process: { argv }, require(name) {
    if (name === 'node:path') return path;
    return { readFileSync(file) {
      reads.push(file);
      if (file.endsWith('rewards-config.ts')) return `iosUnit: '${unit}', androidUnit: 'ca-app-pub-3940256099942544/5224354917'`;
      if (file.endsWith('Info.plist')) return `<key>GADApplicationIdentifier</key><string>${app}</string>`;
      return '<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="ca-app-pub-3940256099942544~3347511713"/>';
    } };
  } });
  return { run: module.exports, reads };
}
const ios = { prepareData: { platform: 'iOS', release: true } };
test('iOS release validates its own IDs without requiring Android production setup', () => {
  const f = hook(); f.run(ios);
  assert.equal(f.reads.some(file => file.includes('Android')), false);
});
test('release rejects test IDs, malformed IDs and publisher mismatch', () => {
  for (const options of [
    { unit: 'ca-app-pub-3940256099942544/1712485313' },
    { app: 'ca-app-pub-3940256099942544~1458002511' },
    { unit: '' }, { app: 'missing' },
    { app: 'ca-app-pub-2222222222222222~1234567890' },
  ]) assert.throws(() => hook(options).run(ios), /Release blocked/);
});
test('Android release still refuses its demo IDs', () => {
  assert.throws(() => hook().run({ prepareData: { platform: 'android', release: true } }), /Release blocked/);
});
test('debug remains usable; release CLI fallback works and unknown targets fail closed', () => {
  const f = hook(); f.run({ prepareData: { platform: 'ios', release: false } }); assert.equal(f.reads.length, 0);
  hook({ argv: ['node', 'tns', 'build', 'ios', '--release'] }).run({});
  assert.throws(() => hook().run({ prepareData: { release: true } }), /cannot determine/);
});
