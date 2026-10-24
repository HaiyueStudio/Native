import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {acquireSha256Digest} from '../src/sha256-capability.ts';
const native=bytes=>new Uint8Array(createHash('sha256').update(bytes).digest());
test('SHA capability preserves selected bytes, copies input and returns an owned digest',async()=>{
 const scope={},bytes=new Uint8Array([0,97,98,99,0]);let received;
 const release=acquireSha256Digest(scope,value=>{received=value;return native(value);});
 const result=scope.crypto.subtle.digest({name:'SHA-256'},bytes.subarray(1,4));bytes.fill(0);
 assert.deepEqual([...received],[97,98,99]);assert.equal(Buffer.from(await result).toString('hex'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
 assert.equal(scope.crypto.getRandomValues,undefined);release();release();assert.equal(Object.hasOwn(scope,'crypto'),false);
});
test('existing digest is borrowed and no platform provider is replaced',()=>{
 const digest=()=>{},crypto={subtle:{digest},getRandomValues(){}};const scope={crypto};
 const release=acquireSha256Digest(scope,()=>{throw Error('unused');});assert.equal(scope.crypto,crypto);assert.equal(scope.crypto.subtle.digest,digest);release();assert.equal(scope.crypto,crypto);
});
test('partial provider is augmented and its exact descriptor restored',()=>{
 const subtle={other:42},crypto={subtle},scope={crypto};Object.defineProperty(subtle,'digest',{value:undefined,configurable:true,enumerable:false});
 const descriptor=Object.getOwnPropertyDescriptor(subtle,'digest'),release=acquireSha256Digest(scope,native);assert.equal(scope.crypto.subtle,subtle);release();assert.deepEqual(Object.getOwnPropertyDescriptor(subtle,'digest'),descriptor);assert.equal(subtle.other,42);
});
test('cleanup does not overwrite a later provider',()=>{
 const scope={crypto:{}},release=acquireSha256Digest(scope,native),later={digest(){}};Object.defineProperty(scope.crypto,'subtle',{value:later,configurable:true});release();assert.equal(scope.crypto.subtle,later);
});
test('unsupported algorithms, inputs and malformed native digests fail explicitly',async()=>{
 const scope={},release=acquireSha256Digest(scope,()=>new Uint8Array(31));
 await assert.rejects(scope.crypto.subtle.digest('SHA-1',new Uint8Array()),/SHA-256 only/);
 await assert.rejects(scope.crypto.subtle.digest('SHA-256',{}),/ArrayBuffer/);
 await assert.rejects(scope.crypto.subtle.digest('SHA-256',new Uint8Array()),/invalid digest/);release();
});
