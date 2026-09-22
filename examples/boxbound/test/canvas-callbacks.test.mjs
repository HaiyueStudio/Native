import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('Canvas Android one-shot callbacks release their owner and both pipe descriptors',()=>{
 const result=spawnSync('python3',[fileURLToPath(new URL('./canvas-callbacks.py',import.meta.url))],{encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
});
