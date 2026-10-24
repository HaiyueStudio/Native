import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
// Emit the same extensionless TS modules used by NativeScript; no browser globals are installed in this process.
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
 const existing=()=>'',scope={btoa:existing},release=acquireBase64Capability(scope);assert.equal(scope.btoa,existing);const later=()=>'';Object.defineProperty(scope,'atob',{value:later,configurable:true});release();release();assert.equal(scope.btoa,existing);assert.equal(scope.atob,later);
});
