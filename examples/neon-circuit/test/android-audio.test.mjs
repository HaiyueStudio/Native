import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
let pool, players=[];
const identity=class {constructor(value){return value;}};
class Attributes {setUsage(){return this;}setContentType(){return this;}build(){return this;}}
class Pool {volumes=[];loaded=[];setOnLoadCompleteListener(l){this.listener=l;}load(path){const id=this.loaded.push(path);queueMicrotask(()=>this.listener.onLoadComplete(this,id,0));return id;}play(){return 1;}stop(){}setVolume(...v){this.volumes.push(v);}autoPause(){}release(){this.released=true;}}
class Player {constructor(){players.push(this);}setAudioAttributes(){}setDataSource(p){this.path=p;}setLooping(v){this.loop=v;}setVolume(...v){this.volume=v;}setOnCompletionListener(l){this.complete=l;}setOnErrorListener(l){this.error=l;}prepare(){}start(){this.started=true;}release(){this.released=true;}}
Player.OnCompletionListener=identity;Player.OnErrorListener=identity;
globalThis.android={content:{Context:{AUDIO_SERVICE:'audio'}},media:{AudioAttributes:Object.assign(Attributes,{Builder:Attributes,USAGE_GAME:1,CONTENT_TYPE_SONIFICATION:1,CONTENT_TYPE_MUSIC:2}),SoundPool:{Builder:class {setMaxStreams(){return this;}setAudioAttributes(){return this;}build(){return pool=new Pool();}},OnLoadCompleteListener:identity},MediaPlayer:Player,AudioManager:{RINGER_MODE_NORMAL:2}}};
const source=ts.transpileModule(readFileSync(new URL('../../../bridge/audio/pcm-bank.android.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020}}).outputText.replace("import { Utils } from '@nativescript/core';","const Utils={android:{getApplicationContext:()=>({getSystemService:()=>({getRingerMode:()=>2})})}};");
const {NativePcmAudioBank}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('long music avoids SoundPool truncation; engine gain changes and suspend release both playback paths',async()=>{
  const bank=new NativePcmAudioBank([{id:'engine',path:'engine.wav',seconds:1},{id:'music',path:'music.wav',seconds:30}]);
  await bank.load();bank.unlock();assert.deepEqual(pool.loaded,['engine.wav']);
  const options={loop:true,gain:.8,pan:0,priority:100};
  assert.equal(bank.play('engine',{...options,channel:'engine'}),true);
  bank.setChannelGain('engine',.2);assert.ok(pool.volumes.at(-1)[1]<.1);
  const writes=pool.volumes.length;
  for(let i=0;i<120;i++)bank.setChannelGain('engine',.2);
  assert.equal(pool.volumes.length,writes,'unchanged frame gain does not cross the native bridge');
  bank.setVolume(.5);assert.equal(pool.volumes.length,writes+1,'master volume still updates existing channels');
  bank.setVolume(.5);assert.equal(pool.volumes.length,writes+1,'unchanged master volume is skipped');
  assert.equal(bank.play('music',{...options,channel:'music'}),true);assert.equal(players[0].path,'music.wav');assert.equal(players[0].loop,true);
  bank.setChannelGain('music',.1);assert.ok(players[0].volume[0]<.05);
  assert.deepEqual(bank.snapshot().loopChannels,['engine','music']);bank.suspend();assert.equal(players[0].released,true);assert.equal(bank.snapshot().voices,0);
  bank.dispose();assert.equal(pool.released,true);
});
