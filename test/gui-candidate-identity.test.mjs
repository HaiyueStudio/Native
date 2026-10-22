import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './support/load-ts.mjs';
const {readCandidateIdentity}=loadTS('examples/ios-gui-text-input/src/candidate.ts');
test('native startup accepts old and normalized candidate identities',()=>{
 for(const schemaVersion of [1,2]){
  const result=readCandidateIdentity(JSON.stringify({schemaVersion,candidateId:'frozen',enginePackage:{sha256:'package-hash'}}));
  assert.equal(result.candidateId,'frozen');assert.equal(result.enginePackage.sha256,'package-hash');
 }
});
test('native startup rejects missing identity and unsupported manifest versions',()=>{
 for(const candidate of [null,{}, {schemaVersion:3,candidateId:'frozen',enginePackage:{}},{schemaVersion:2,candidateId:'',enginePackage:{}},{schemaVersion:2,candidateId:3,enginePackage:{}},{schemaVersion:2,candidateId:'frozen'}]){
  assert.throws(()=>readCandidateIdentity(JSON.stringify(candidate)),/manifest is missing or invalid/);
 }
 assert.throws(()=>readCandidateIdentity('{'));
});
