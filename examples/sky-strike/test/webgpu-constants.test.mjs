import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const source=readFileSync(new URL('../../../bridge/render/webgpu-constants.ts', import.meta.url),'utf8');
const {installNativeWebGpuConstants}=await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source))}`);
test('bridge supplies missing color mask while retaining a provider-owned implementation',()=>{
  const target={}; installNativeWebGpuConstants(target); assert.equal(target.GPUColorWrite.ALL,15); assert.ok(Object.isFrozen(target.GPUColorWrite));
  const native={ALL:15}; const owned={GPUColorWrite:native}; installNativeWebGpuConstants(owned); assert.equal(owned.GPUColorWrite,native);
});
