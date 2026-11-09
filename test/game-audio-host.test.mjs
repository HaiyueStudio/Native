import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './support/load-ts.mjs';

function fixture(){
  const observers=new Map(),timers=new Map(),connections=[],players=[];
  const nodes=new Set(),errors=[];let serial=0;
  const mixer=()=>({outputVolume:1,pan:0});
  const session={sampleRate:48000,outputNumberOfChannels:2,active:false,
    setCategoryError:()=>true,setActiveError(active){this.active=active;return true;},
    setActiveWithOptionsError(active){this.active=active;return true;}};
  const engine={mainMixerNode:mixer(),running:false,attachNode:node=>nodes.add(node),
    connectToFormat(...args){connections.push(args);},disconnectNodeOutput:node=>connections.push(['disconnect',node]),detachNode:node=>nodes.delete(node),
    startAndReturnError(){this.running=true;return true;},pause(){this.running=false;},stop(){this.running=false;}};
  const format={sampleRate:48000,channelCount:1};
  const pointer=(buffer,offset=0)=>({buffer,offset,add:value=>pointer(buffer,offset+value)});
  const globals={
    AVAudioEngine:{new:()=>engine},AVAudioMixerNode:{new:mixer},AVAudioSession:{sharedInstance:()=>session},
    AVAudioFormat:{alloc:()=>({initStandardFormatWithSampleRateChannels:(sampleRate,channelCount)=>({sampleRate,channelCount})})},
    AVAudioUnitEQ:{alloc:()=>({initWithNumberOfBands:()=>({globalGain:0,bands:{objectAtIndex:()=>({bypass:false})}})})},
    AVAudioUnitVarispeed:{new:()=>({rate:1})},
    AVAudioPCMBuffer:{alloc:()=>({initWithPCMFormatFrameCapacity:(format,frames)=>({
      format,frameLength:frames,floatChannelData:Array.from({length:format.channelCount},()=>pointer(new ArrayBuffer(frames*4))),
    })})},
    AVAudioPlayerNode:{new:()=>{
      const player={lastRenderTime:{},now:0,playing:false,
        playerTimeForNodeTime(){return {sampleTimeValid:true,sampleRate:48000,sampleTime:this.now};},
        scheduleBufferAtTimeOptionsCompletionHandler(buffer,when,options,callback){this.scheduled={buffer,when,options,callback};},
        play(){this.playing=true;},stop(){this.playing=false;this.stops=(this.stops??0)+1;}};
      players.push(player);return player;
    }},
    AVAudioFile:{alloc:()=>({initForReadingCommonFormatInterleavedError:()=>({
      processingFormat:format,length:2,readIntoBufferError(pcm){new Float32Array(pcm.floatChannelData[0].buffer).set([.25,-.5]);return true;},
    })})},
    AVAudioCommonFormat:{PCMFormatFloat32:1},AVAudioPlayerNodeBufferOptions:{Loops:1},
    AVAudioSessionSetActiveOptions:{NotifyOthersOnDeactivation:1},AVAudioSessionCategoryAmbient:'ambient',
    AVAudioSessionInterruptionNotification:'interruption',AVAudioSessionInterruptionTypeKey:'type',AVAudioSessionInterruptionOptionKey:'option',
    AVAudioSessionInterruptionType:{Began:1,Ended:0},AVAudioSessionInterruptionOptions:{ShouldResume:1},
    AVAudioSessionRouteChangeNotification:'route',AVAudioSessionRouteChangeReasonKey:'reason',AVAudioSessionRouteChangeReason:{OldDeviceUnavailable:2},
    AVAudioEngineConfigurationChangeNotification:'configuration',NSOperationQueue:{mainQueue:{}},
    NSNotificationCenter:{defaultCenter:{addObserverForNameObjectQueueUsingBlock(name,_object,_queue,callback){observers.set(name,callback);return name;},removeObserver:name=>observers.delete(name)}},
    NSURL:{fileURLWithPath:p=>p},NSData:{dataWithBytesLength:()=>({writeToURLOptionsError:()=>true}),
      dataWithBytesNoCopyLengthFreeWhenDone:(source,length)=>({source,length,
        getBytesLength(to,count){new Uint8Array(to.buffer,to.offset,count).set(new Uint8Array(source.buffer,source.offset,count));},
      })},
    NSFileManager:{defaultManager:{fileExistsAtPath:()=>true,removeItemAtPathError:()=>true}},
    interop:{handleof:pointer,bufferFromData:({source,length})=>source.buffer.slice(source.offset,source.offset+length)},
    setInterval:callback=>{const id=++serial;timers.set(id,callback);return id;},clearInterval:id=>timers.delete(id),
  };
  const {IosGameAudioHost}=loadTS('bridge/audio/game-audio.ios.ts',{'@nativescript/core':{knownFolders:{temp:()=>({path:'tmp'})},path:{join:(...p)=>p.join('/')}}},globals);
  const host=new IosGameAudioHost((...args)=>errors.push(args));
  return {host,engine,session,nodes,connections,players,observers,timers,errors,
    tick:()=>{for(const callback of timers.values())callback();},
    emit(name,data){observers.get(name)?.({userInfo:{objectForKey:key=>data[key]}});}};
}

test('iOS host routes gain, stereo, rate, finite completion and cleanup through its SDK interfaces',async()=>{
  const f=fixture(),{host}=f;
  assert.equal(host.state,'suspended');assert.equal(host.stereoPan,false);
  await host.resume();assert.equal(host.stereoPan,true);assert.equal(host.nodeCount,12);
  const pcm=await host.decodeAudioData(new ArrayBuffer(12));
  assert.deepEqual(Array.from(pcm.getChannelData(0)),[.25,-.5]);
  const buffer=host.createBuffer(1,48000,48000);
  buffer.getChannelData(0)[0]=.5;
  const voice=host.openVoice(buffer,{bus:'ui',loop:false,frequency:8,gain:2,pan:-1});
  assert.equal(voice.nodeCount,4);
  const [output,_player,rateA,rateB,preamp]=[...f.nodes].slice(12);
  assert.deepEqual([rateA.rate,rateB.rate],[Math.sqrt(8),Math.sqrt(8)]);
  assert.equal(preamp.globalGain,20*Math.log10(2));
  assert.equal(output.pan,-1);
  voice.setPan(1);voice.setGain(0);
  assert.equal(output.pan,1);assert.equal(output.outputVolume,0);
  let ended=0;
  voice.start(()=>{ended++;voice.dispose();});
  assert.equal(f.players[0].scheduled.callback,null);
  assert.equal(new Float32Array(f.players[0].scheduled.buffer.floatChannelData[0].buffer)[0],.5);
  f.players[0].now=47999;f.tick();assert.equal(ended,0);
  f.players[0].now=48000;f.tick();assert.equal(ended,1);assert.equal(f.timers.size,0);
  const reused=host.openVoice(buffer,{bus:'sfx',loop:true,frequency:1,gain:1,pan:0});
  assert.equal(host.nodeCount,13);assert.equal(f.connections.findLast(connection=>connection[0]==='disconnect')[1],output);
  voice.setPan(-1);voice.setGain(0);assert.equal(output.pan,0);assert.equal(output.outputVolume,1);
  reused.dispose();
  host.close();assert.equal(host.nodeCount,0);assert.equal(f.nodes.size,0);
  assert.equal(f.observers.size,0);assert.equal(f.session.active,false);
});

test('iOS keeps a loop through pause and interruption, reports unsupported mono route, and releases once',async()=>{
  const f=fixture(),{host}=f;await host.resume();
  const voice=host.openVoice(host.createBuffer(1,2,48000),{bus:'music',loop:true,frequency:1,gain:1,pan:0});
  voice.start(()=>assert.fail('A loop must not finish by polling.'));
  assert.equal(f.timers.size,0);assert.equal(f.players[0].scheduled.options,1);
  await host.suspend();assert.equal(host.state,'suspended');assert.equal(f.players[0].stops,undefined);
  await host.resume();f.session.outputNumberOfChannels=1;assert.equal(host.stereoPan,false);
  f.emit('interruption',{type:1});assert.equal(host.state,'interrupted');
  f.emit('interruption',{type:0,option:1});assert.equal(host.state,'running');
  voice.stop();voice.dispose();host.close();host.close();
  assert.equal(f.players[0].stops,1);assert.equal(f.nodes.size,0);assert.equal(f.errors.length,0);
});
