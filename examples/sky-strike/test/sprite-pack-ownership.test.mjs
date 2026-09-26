import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';

test('native sprite pack owns its pixels after the temporary NSData storage is released', () => {
  const source=readFileSync(new URL('../src/main-page.ts',import.meta.url),'utf8');
  const start=source.indexOf('const data = NSData.dataWithContentsOfFile(');
  const end=source.indexOf("world = new World('Sky Strike Native')",start);
  assert.ok(start>=0 && end>start);
  const nativeStorage=new Uint8Array([8,17,29,255,4,33,75,128]);
  const load=new Function('NSData','interop','path','assetsRoot',`${source.slice(start,end)} return bytes;`);
  const pixels=load({dataWithContentsOfFile:()=>({})},{bufferFromData:()=>nativeStorage.buffer},path,'assets');
  assert.notEqual(pixels.buffer,nativeStorage.buffer,'lazy boss compositions must not retain a borrowed NSData buffer');
  nativeStorage.fill(0); // Simulate the original native allocation becoming unusable.
  assert.deepEqual([...pixels],[8,17,29,255,4,33,75,128]);
});
