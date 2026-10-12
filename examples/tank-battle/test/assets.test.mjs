import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const assets=new URL('../../../games/tank-battle/assets/',import.meta.url);
test('native texture packs have valid RGBA byte counts and transparent touch controls',()=>{
 for(const name of ['controls','mobile-atlas']){
  const meta=JSON.parse(readFileSync(new URL(name+'.json',assets),'utf8'));
  const bytes=readFileSync(new URL(name+'.rgba',assets));assert.equal(bytes.length,meta.width*meta.height*4);
  assert.ok(meta.width<=2048&&meta.height<=2048);
  if(name==='controls'){assert.equal(bytes[3],0);assert.ok(bytes.some((value,i)=>i%4===3&&value===255));assert.equal(meta.width,meta.height);assert.equal(meta.width%2,0);}
 }
});
test('native sound bank is mono 44.1 kHz PCM with a valid payload',()=>{
 for(const name of ['shoot','hit','explode','pickup','over','clear']){
  const bytes=readFileSync(new URL(name+'.wav',assets));assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.readUInt16LE(22),1);assert.equal(bytes.readUInt32LE(24),44100);assert.equal(bytes.readUInt16LE(34),16);assert.equal(bytes.readUInt32LE(40),bytes.length-44);
 }
});
