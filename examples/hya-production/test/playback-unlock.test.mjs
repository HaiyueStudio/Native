import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(readFileSync(new URL('../src/playback-unlock.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {NativePlaybackUnlock}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
function player(status='running') {
  return {status,pauses:0,resumes:0,unlocks:0,unlocked:false,
    pause(){this.pauses++;this.status='paused';this.unlocked=false;},
    async unlockAudio(){this.unlocks++;this.unlocked=true;},
    resume(){assert.equal(this.unlocked,true,'Native autoplay contract');this.resumes++;this.status='running';},
  };
}
test('probe/background suspension stays paused until the next actual unlock, preserving a manual pause',async()=>{
  const gate=new NativePlaybackUnlock(),p=player();gate.pause(p);gate.pause(p);
  assert.equal(p.pauses,1);assert.equal(p.resumes,0);assert.equal(gate.pending,true);
  const pending=gate.unlock(p);assert.equal(p.unlocks,1,'unlock must start in the calling gesture');await pending;
  assert.equal(p.resumes,1);assert.equal(gate.pending,false);
  const manual=new NativePlaybackUnlock(),paused=player('paused');manual.pause(paused);await manual.unlock(paused);
  assert.equal(paused.status,'paused');assert.equal(paused.resumes,0);
});
test('failed unlock retains the pending resume for a later gesture',async()=>{
  const gate=new NativePlaybackUnlock(),p=player();gate.pause(p);
  const unlock=p.unlockAudio;p.unlockAudio=async()=>{throw new Error('route unavailable');};
  await assert.rejects(gate.unlock(p),/route unavailable/);assert.equal(gate.pending,true);assert.equal(p.resumes,0);
  p.unlockAudio=unlock;await gate.unlock(p);assert.equal(p.resumes,1);assert.equal(gate.pending,false);
});
test('late unlock cannot resume after disposal or a newer background suspension',async()=>{
  for(const disposed of [false,true]) {
    const gate=new NativePlaybackUnlock(),p=player();gate.pause(p);let complete;
    p.unlockAudio=()=>new Promise(resolve=>{complete=resolve;});
    const pending=gate.unlock(p);if(disposed)gate.dispose();else gate.pause(p);complete();await pending;
    assert.equal(p.resumes,0);assert.equal(gate.pending,!disposed);
  }
});
