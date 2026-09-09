import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { patchRenderPassSource } from '../scripts/patch-canvas.mjs';

const source = readFileSync(new URL('../node_modules/@nativescript/canvas/WebGPU/GPURenderPassEncoder.js', import.meta.url), 'utf8');
const fixed = patchRenderPassSource(source);
const method = fixed.slice(fixed.indexOf('    setBindGroup('), fixed.indexOf('    setBlendConstant('));
const native = Symbol('native');
const encoder = Function('native_', `return ({ ${method} });`)(native);
const group = { [native]: {} };
let call;
encoder[native] = { setBindGroup: (...args) => { call = args; } };

test('Engine typed-array offsets reach native without losing count or copying the view', () => {
  const offsets = new Uint32Array([256, 512, 768]).subarray(1);
  encoder.setBindGroup(0, group, offsets);
  assert.equal(call[2], offsets);
  assert.deepEqual(call.slice(3), [0, 2]);
  encoder.setBindGroup(0, group, offsets, 1, 1);
  assert.deepEqual(call.slice(3), [1, 1]);
  encoder.setBindGroup(0, group, offsets, 1, 0);
  assert.deepEqual(call.slice(3), [1, 0]);
});

test('ordinary offset arrays and bindings without offsets retain Canvas behavior', () => {
  encoder.setBindGroup(0, group, [256]);
  assert.deepEqual([...call[2]], [256]);
  assert.deepEqual(call.slice(3), [0, 1]);
  encoder.setBindGroup(1, group);
  assert.equal(call.length, 2);
  assert.equal(patchRenderPassSource(fixed), fixed);
  assert.throws(() => patchRenderPassSource('unexpected source'));
});
