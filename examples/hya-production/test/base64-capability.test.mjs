import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,mkdtempSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
// Emit the same extensionless TS modules used by NativeScript; no browser globals are installed in this process.
mkdirSync(new URL('../artifacts/',import.meta.url),{recursive:true});
const temp=mkdtempSync(new URL('../artifacts/base64-capability-',import.meta.url));
for(const name of ['bytes-base64','base64-capability']){const source=readFileSync(new URL('../src/'+name+'.ts',import.meta.url),'utf8'),js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("'./bytes-base64'","'./bytes-base64.js'");writeFileSync(resolve(temp,name+'.js'),js);}
writeFileSync(resolve(temp,'package.json'),'{"type":"module","private":true}\n');
const {acquireBase64Capability}=await import(pathToFileURL(resolve(temp,'base64-capability.js')));
test('native binary-string boundary matches independent platform base64 across byte ranges',()=>{
 const scope={},release=acquireBase64Capability(scope);for(const size of [0,1,2,3,256,8193,65536]){const bytes=Uint8Array.from({length:size},(_,i)=>i%256),text=Array.from(bytes,b=>String.fromCharCode(b)).join('');assert.equal(scope.btoa(text),btoa(text));assert.equal(scope.atob(btoa(text)),text);}release();assert.deepEqual(Object.keys(scope),[]);
});
test('forgiving base64 supports whitespace/unpadded values and rejects invalid inputs',()=>{
 const scope={},release=acquireBase64Capability(scope);for(const text of ['YQ','YWI','YQ==',' YW\tJj\r\n',''])assert.equal(scope.atob(text),atob(text));
 for(const text of ['A','A=','A===','YW=J','YQ===','**','a==='])assert.throws(()=>scope.atob(text),{name:'InvalidCharacterError'});
 assert.throws(()=>scope.btoa('你好'),{name:'InvalidCharacterError'});release();
});
test('runtime base64 implementations and later ownership are preserved',()=>{
 const scope={btoa,atob},release=acquireBase64Capability(scope);assert.equal(scope.btoa,btoa);assert.equal(scope.atob,atob);release();assert.equal(scope.btoa,btoa);assert.equal(scope.atob,atob);
 const missing={},releaseMissing=acquireBase64Capability(missing),later=()=>'';Object.defineProperty(missing,'atob',{value:later,configurable:true});releaseMissing();releaseMissing();assert.equal(missing.atob,later);assert.equal('btoa' in missing,false);
});
test('UTF-8 NSString-style providers are replaced for binary bytes and restored exactly',()=>{
 const scope={};
 const nativeEncode=text=>Buffer.from(text,'utf8').toString('base64');
 const nativeDecode=text=>Buffer.from(text,'base64').toString('utf8');
 Object.defineProperty(scope,'btoa',{value:nativeEncode,configurable:true,writable:false,enumerable:false});
 Object.defineProperty(scope,'atob',{get:()=>nativeDecode,configurable:true,enumerable:true});
 const before=Object.getOwnPropertyDescriptors(scope),release=acquireBase64Capability(scope);
 const binary=Array.from({length:256},(_,i)=>String.fromCharCode(i)).join('');
 assert.equal(scope.btoa(binary),btoa(binary));assert.equal(scope.atob(btoa(binary)),binary);
 assert.throws(()=>scope.btoa('你好'),{name:'InvalidCharacterError'});
 assert.throws(()=>scope.atob('YQ==='),{name:'InvalidCharacterError'});
 release();release();assert.deepEqual(Object.getOwnPropertyDescriptors(scope),before);
});
test('replacement rolls back when an incompatible provider is not configurable',()=>{
 const scope={btoa:()=>''};Object.defineProperty(scope,'atob',{value:()=>'',configurable:false});
 const before=Object.getOwnPropertyDescriptors(scope);assert.throws(()=>acquireBase64Capability(scope));
 assert.deepEqual(Object.getOwnPropertyDescriptors(scope),before);
});
