import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { syncGameAssets, runtimeAssets } from '../scripts/sync-game-assets.mjs';
test('runtime staging includes all levels/pack and removes obsolete master PNGs',()=>{
 const root=mkdtempSync(join(tmpdir(),'sky-assets-')),source=pathToFileURL(root+'/source/'),target=pathToFileURL(root+'/target/'),stale=pathToFileURL(root+'/stale/');
 try {
  for(const folder of [new URL('assets/',source),new URL('levels/',source),target,stale])mkdirSync(folder,{recursive:true});
  mkdirSync(new URL('assets/audio/',source),{recursive:true});
  for(const f of runtimeAssets)writeFileSync(new URL(f,source),'fixture');
  writeFileSync(new URL('assets/unused-master.png',source),'large art');writeFileSync(new URL('old.png',target),'stale');writeFileSync(new URL('old.png',stale),'stale');
  syncGameAssets({source,target,staleTargets:[stale]});
  for(const f of runtimeAssets)assert.ok(existsSync(new URL(f,target)));
  assert.equal(existsSync(new URL('old.png',target)),false);assert.equal(existsSync(new URL('assets/unused-master.png',target)),false);assert.equal(existsSync(stale),false);
 } finally {rmSync(root,{recursive:true,force:true});}
});
