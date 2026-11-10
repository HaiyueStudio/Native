import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './support/load-ts.mjs';
const {readCandidateIdentity}=loadTS('examples/ios-gui-text-input/src/candidate.ts');
const g11={
 schemaVersion:3,targetVersion:'0.2.3',releaseQualified:false,candidateId:'g11-frozen',
 enginePackage:{name:'@haiyue/engine',version:'0.2.3',sha256:'a'.repeat(64),bytes:100},
 extensionsPackage:{name:'@haiyue/extensions',version:'0.2.3',sha256:'b'.repeat(64),bytes:200},
};
test('native startup accepts old and normalized candidate identities',()=>{
 for(const schemaVersion of [1,2]){
  const result=readCandidateIdentity(JSON.stringify({schemaVersion,candidateId:'frozen',enginePackage:{sha256:'package-hash'}}));
  assert.equal(result.candidateId,'frozen');assert.equal(result.enginePackage.sha256,'package-hash');
 }
});
test('native startup rejects missing identity and unsupported manifest versions',()=>{
 for(const candidate of [null,{}, {...g11,schemaVersion:4},{schemaVersion:2,candidateId:'',enginePackage:{}},{schemaVersion:2,candidateId:3,enginePackage:{}},{schemaVersion:2,candidateId:'frozen'}]){
  assert.throws(()=>readCandidateIdentity(JSON.stringify(candidate)),/manifest is missing or invalid/);
 }
 assert.throws(()=>readCandidateIdentity('{'));
});
test('native startup accepts v3 only with both exact 0.2.3 package identities',()=>{
 const {candidateId,enginePackage,extensionsPackage}=g11;
 assert.deepEqual(JSON.parse(JSON.stringify(readCandidateIdentity(JSON.stringify(g11)))),{candidateId,enginePackage,extensionsPackage});
 for(const candidate of [
  {...g11,targetVersion:'0.2.2'},
  {...g11,releaseQualified:true},
  {...g11,extensionsPackage:undefined},
  {...g11,extensionsPackage:{...extensionsPackage,bytes:0}},
  {...g11,enginePackage:{...enginePackage,sha256:'unverified'}},
 ]){
  assert.throws(()=>readCandidateIdentity(JSON.stringify(candidate)),/requires both exact 0\.2\.3 candidate packages/u);
 }
});
