import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTS } from './support/load-ts.mjs';

test('GameKit FFI retains one library for late callbacks and reuses it across sequential clients', async () => {
  let opens = 0, closes = 0, stops = 0;
  const encoder = new TextEncoder();
  const write = (text, buffer) => { const bytes = encoder.encode(text); buffer.set(bytes); return bytes.length; };
  const Deno = { realPathSync: path => path, dlopen() {
    opens++;
    return { close() { closes++; }, symbols: { hy_gc_abi: () => 1, hy_gc_start() {},
      hy_gc_session: buffer => write('{"state":"guest"}', buffer), hy_gc_poll: buffer => write('[]', buffer),
      hy_gc_request: () => 1, hy_gc_stop() { stops++; } } };
  } };
  const { createDesktopGameCenterClient } = loadTS('desktop/platform-libs/game-center/client.ts', {}, { Deno, TextEncoder, TextDecoder, setInterval, clearInterval });
  for (let i = 0; i < 20; i++) {
    const client = createDesktopGameCenterClient('/gamekit.dylib');
    assert.throws(() => createDesktopGameCenterClient('/gamekit.dylib'), /owns/);
    await client.initialize('org.example.game');
    client.dispose(); client.dispose();
  }
  assert.equal(opens, 1); assert.equal(closes, 0); assert.equal(stops, 20);
  assert.throws(() => createDesktopGameCenterClient('/replacement.dylib'), /Restart/);
});
