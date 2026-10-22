import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './support/load-ts.mjs';
const {installNativeTextureUploads}=loadTS('bridge/render/texture-upload.ts',{}, {ArrayBuffer,SharedArrayBuffer,Uint8Array});
test('native texture upload accepts ArrayBuffer, typed subviews and DataView without losing byte offsets',()=>{
 const calls=[],queue={writeTexture(...args){assert.equal(this,queue);assert.ok(args[1] instanceof Uint8Array);calls.push(args);}},device={queue};
 installNativeTextureUploads(device);const wrapped=queue.writeTexture;installNativeTextureUploads(device);assert.equal(queue.writeTexture,wrapped);
 const backing=new Uint8Array([1,2,3,4,5,6,7,8]),destination={},layout={offset:1,bytesPerRow:4},size=[1,1];
 for(const input of [backing.buffer,backing.subarray(2,6),new Uint16Array(backing.buffer,2,2),new DataView(backing.buffer,3,4),new SharedArrayBuffer(8)]){
  queue.writeTexture(destination,input,layout,size);const args=calls.at(-1),view=args[1];
  assert.equal(view.buffer,ArrayBuffer.isView(input)?input.buffer:input);assert.equal(view.byteOffset,input.byteOffset??0);assert.equal(view.byteLength,input.byteLength);
  assert.equal(args[0],destination);assert.equal(args[2],layout);assert.equal(args[3],size);
 }
});
test('native texture upload rejects invalid inputs before native code and preserves native errors',()=>{
 let calls=0;const failure=Error('GPU validation');const queue={writeTexture(){calls++;throw failure;}};installNativeTextureUploads({queue});
 for(const input of [null,undefined,{},[1,2,3],'pixels'])assert.throws(()=>queue.writeTexture({},input,{},[1,1]),/requires an ArrayBuffer/);
 assert.equal(calls,0);assert.throws(()=>queue.writeTexture({},new ArrayBuffer(4),{},[1,1]),e=>e===failure);assert.equal(calls,1);
});
