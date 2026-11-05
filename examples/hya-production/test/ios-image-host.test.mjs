import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync, mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

mkdirSync(new URL('../artifacts/', import.meta.url), {recursive: true});
const temp = mkdtempSync(new URL('../artifacts/ios-image-boundary-', import.meta.url));
writeFileSync(resolve(temp, 'package.json'), '{"type":"module","private":true}\n');
for (const name of ['image-host', 'ios-image-host', 'native-bitmap-uploads']) {
  const source = readFileSync(new URL('../src/' + name + '.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText
    .replace("'@nativescript/canvas'", "'./canvas-boundary.js'").replace("'./image-host'", "'./image-host.js'").replace("'./native-bitmap-uploads'", "'./native-bitmap-uploads.js'");
  writeFileSync(resolve(temp, name + '.js'), js);
}
// This models the pinned C++ callback's ArrayBuffer requirement, not device pixels.
writeFileSync(resolve(temp, 'canvas-boundary.js'), `
  import assert from 'node:assert/strict';
  export const calls = {buffers: [], bitmaps: [], fail: false};
  export class Canvas {}
  export class ImageAsset {
    loadFromEncodedBytesSync(bytes) {
      assert.ok(this instanceof ImageAsset);
      assert.ok(bytes instanceof ArrayBuffer, 'iOS FromEncodedBytesCb requires ArrayBuffer');
      calls.buffers.push(bytes);
      return !calls.fail;
    }
  }
  export class ImageBitmap {
    width = 2; height = 1; closed = 0;
    close() { this.closed++; }
    static async createFrom(source) {
      assert.ok(source instanceof ImageAsset || source instanceof Canvas || source instanceof ImageBitmap);
      const bitmap = new ImageBitmap(); calls.bitmaps.push(bitmap); return bitmap;
    }
  }
`);
const {createIosHyaImageHost} = await import(pathToFileURL(resolve(temp, 'ios-image-host.js')));
const makeHost = () => createIosHyaImageHost({copyExternalImageToTexture() {throw new Error('Unexpected native asset copy');}, writeTexture() {}});
const {acquireNativeBitmapUploads} = await import(pathToFileURL(resolve(temp, 'native-bitmap-uploads.js')));
const {calls} = await import(pathToFileURL(resolve(temp, 'canvas-boundary.js')));

test('iOS encoded-image boundary passes an owned ArrayBuffer with the exact view range', async () => {
  const input = new Uint8Array([99, 137, 80, 78, 71, 99]);
  const decoding = makeHost().decode(input.subarray(1, 5), new AbortController().signal);
  input.fill(0);
  const lease = await decoding;
  assert.deepEqual([...new Uint8Array(calls.buffers.at(-1))], [137, 80, 78, 71]);
  lease.release(); lease.release();
  assert.equal(lease.value.closed, 1);
});
test('iOS decoder failure rejects; cancellation releases a bitmap that completed late', async () => {
  calls.fail = true;
  const before = calls.bitmaps.length;
  await assert.rejects(makeHost().decode(new Uint8Array([0]), new AbortController().signal), /could not be decoded/);
  assert.equal(calls.bitmaps.length, before);
  calls.fail = false;
  const abort = new AbortController();
  const pending = makeHost().decode(new Uint8Array([0]), abort.signal);
  abort.abort();
  await assert.rejects(pending, {name: 'AbortError'});
  assert.equal(calls.bitmaps.at(-1).closed, 1);
});


test('owned 3x3 bitmaps upload exact rows with alpha conversion and retain the original texture owner', () => {
  const writes = [], external = [];
  const queue = {copyExternalImageToTexture(...args) {external.push(args);}, writeTexture(...args) {writes.push(args);}};
  const original = Object.getOwnPropertyDescriptor(queue, 'copyExternalImageToTexture');
  const pixels = new Uint8Array(36);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([200, 100, 50, 128], i);
  const scope = acquireNativeBitmapUploads(queue, () => pixels);
  const bitmap = scope.own({width: 3, height: 3, close() {}});
  const texture = {format: 'rgba8unorm-srgb'};
  const destination = {texture, premultipliedAlpha: true};
  queue.copyExternalImageToTexture({source: bitmap}, destination, [3, 3]);
  assert.equal(external.length, 0);
  assert.equal(writes[0][0], destination);
  assert.equal(writes[0][1].byteLength, 36);
  assert.deepEqual([...writes[0][1].subarray(0, 4)], [100, 50, 25, 128]);
  assert.deepEqual(writes[0][2], {bytesPerRow: 12, rowsPerImage: 3});
  assert.deepEqual(writes[0][3], [3, 3, 1]);
  assert.deepEqual([...pixels.subarray(0, 4)], [200, 100, 50, 128]);
  queue.copyExternalImageToTexture({source: bitmap}, {texture: {format: 'bgra8unorm'}, premultipliedAlpha: false}, {width: 3, height: 3});
  assert.deepEqual([...writes[1][1].subarray(0, 4)], [50, 100, 200, 128]);
  queue.copyExternalImageToTexture({source: {}}, destination, [3, 3]);
  assert.equal(external.length, 1);
  scope.dispose(); scope.dispose();
  assert.deepEqual(Object.getOwnPropertyDescriptor(queue, 'copyExternalImageToTexture'), original);
});

test('bitmap fallback rejects unsupported crops/formats and preserves later queue ownership', () => {
  const queue = {copyExternalImageToTexture() {}, writeTexture() {throw new Error('Invalid copy reached GPU');}};
  const scope = acquireNativeBitmapUploads(queue, () => new Uint8Array(36));
  let closed = 0;
  const bitmap = scope.own({width: 3, height: 3, close() {closed++;}});
  assert.throws(() => queue.copyExternalImageToTexture({source: bitmap, origin: [1, 0]}, {texture: {format: 'rgba8unorm'}}, [3, 3]), /complete bitmap/);
  assert.throws(() => queue.copyExternalImageToTexture({source: bitmap}, {texture: {format: 'rgba16float'}}, [3, 3]), /RGBA8/);
  const later = () => {};
  queue.copyExternalImageToTexture = later;
  scope.dispose();
  assert.equal(queue.copyExternalImageToTexture, later);
  assert.throws(() => scope.own(bitmap), /closed/);
  assert.equal(closed, 1);
});
