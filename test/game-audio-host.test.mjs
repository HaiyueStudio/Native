import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadTS} from './support/load-ts.mjs';

function fixture({onPcm,frameLengthDelta=0,bridgeFrameLength=false,corruptCopy=false}={}){
  const observers=new Map(),timers=new Map(),connections=[],players=[],engines=[],tempFiles=new Map(),references=[];
  const nodes=new Set(),errors=[];let serial=0;
  const mixer=()=>({outputVolume:1,pan:0});
  const session={sampleRate:48000,outputNumberOfChannels:2,outputVolume:.7,active:false,activations:0,activationAllowed:true,
    setCategoryError:()=>true,setActiveError(active,error){
      this.activations++;
      if(!this.activationAllowed){error.value={localizedDescription:'route unavailable',code:123};return false;}
      this.active=active;return true;
    },
    setActiveWithOptionsError(active){this.active=active;return true;}};
  const makeEngine=()=>({mainMixerNode:mixer(),running:false,attachNode:node=>nodes.add(node),
    connectToFormat(...args){connections.push(args);},disconnectNodeOutput:node=>connections.push(['disconnect',node]),detachNode:node=>nodes.delete(node),
    enableManualRenderingModeFormatMaximumFrameCountError(_mode,format){this.manualRenderingFormat=format;return true;},
    renderOfflineToBufferError(frames,pcm){
      pcm.frameLength=frames;
      const input=players.at(-1).scheduled.buffer;
      for(const output of pcm.floatChannelData){
        const source=new Float32Array(input.floatChannelData[0].buffer);
        const target=new Float32Array(output.buffer);
        for(let i=0;i<frames;i++)target[i]=source[i%source.length]/Math.sqrt(2);
      }
      return 0;
    },
    startAndReturnError(){this.running=true;return true;},pause(){this.running=false;},stop(){this.running=false;}});
  const format={sampleRate:48000,channelCount:1};
  const pointer=(buffer,offset=0)=>({buffer,offset,add:value=>pointer(buffer,offset+value)});
  const globals={
    AVAudioEngine:{new:()=>{const engine=makeEngine();engines.push(engine);return engine;}},
    AVAudioEngineManualRenderingMode:{Offline:0},AVAudioEngineManualRenderingStatus:{Error:-1,Success:0},
    AVAudioMixerNode:{new:mixer},AVAudioSession:{sharedInstance:()=>session},
    AVAudioFormat:{alloc:()=>({initStandardFormatWithSampleRateChannels:(sampleRate,channelCount)=>({sampleRate,channelCount})})},
    AVAudioUnitEQ:{alloc:()=>({initWithNumberOfBands:()=>({globalGain:0,bands:{objectAtIndex:()=>({bypass:false})}})})},
    AVAudioUnitVarispeed:{new:()=>({rate:1})},
    AVAudioPCMBuffer:{alloc:()=>({initWithPCMFormatFrameCapacity:(format,frames)=>{
      let length=frames;
      return {format,frameCapacity:frames,stride:1,
        get frameLength(){return bridgeFrameLength?BigInt(length):length;},
        set frameLength(value){length=Number(value)+frameLengthDelta;},
        floatChannelData:Array.from({length:format.channelCount},()=>pointer(new ArrayBuffer(frames*4))),
      };
    }})},
    AVAudioPlayerNode:{new:()=>{
      const player={lastRenderTime:{},now:0,playing:false,
        playerTimeForNodeTime(){return {sampleTimeValid:true,sampleRate:48000,sampleTime:this.now};},
        scheduleBufferAtTimeOptionsCompletionHandler(buffer,when,options,callback){this.scheduleCount=(this.scheduleCount??0)+1;this.scheduled={buffer,when,options,callback};},
        play(){this.playing=true;},stop(){this.playing=false;this.stops=(this.stops??0)+1;}};
      players.push(player);return player;
    }},
    AVAudioPlayer:{alloc:()=>({initWithDataError(data){
      const header=new DataView(data.source.buffer);
      assert.equal(header.getUint32(0),0x52494646);
      assert.equal(header.getUint32(8),0x57415645);
      assert.equal(header.getUint16(34,true),16);
      const player={playing:false,play(){this.playing=true;return true;},stop(){this.playing=false;}};
      references.push(player);return player;
    }})},
    AVAudioFile:{alloc:()=>({initForReadingCommonFormatInterleavedError:()=>({
      processingFormat:format,length:2,readIntoBufferError(pcm){
        new Float32Array(pcm.floatChannelData[0].buffer).set([.25,-.5]);return true;
      },
    })})},
    AVAudioCommonFormat:{PCMFormatFloat32:1},AVAudioPlayerNodeBufferOptions:{Loops:1},
    AVAudioSessionSetActiveOptions:{NotifyOthersOnDeactivation:1},AVAudioSessionCategoryAmbient:'ambient',
    AVAudioSessionInterruptionNotification:'interruption',AVAudioSessionInterruptionTypeKey:'type',AVAudioSessionInterruptionOptionKey:'option',
    AVAudioSessionInterruptionWasSuspendedKey:'wasSuspended',
    AVAudioSessionInterruptionReasonKey:'reason',AVAudioSessionInterruptionReason:{AppWasSuspended:1},
    AVAudioSessionInterruptionType:{Began:1,Ended:0},AVAudioSessionInterruptionOptions:{ShouldResume:1},
    AVAudioSessionRouteChangeNotification:'route',AVAudioSessionRouteChangeReasonKey:'reason',AVAudioSessionRouteChangeReason:{OldDeviceUnavailable:2},
    AVAudioEngineConfigurationChangeNotification:'configuration',NSOperationQueue:{mainQueue:{}},
    NSNotificationCenter:{defaultCenter:{addObserverForNameObjectQueueUsingBlock(name,_object,_queue,callback){observers.set(name,callback);return name;},removeObserver:name=>observers.delete(name)}},
    NSURL:{fileURLWithPath:p=>p},NSData:{dataWithBytesLength:(source,length)=>({source,
      writeToURLOptionsError(url){tempFiles.set(url,source.buffer.slice(source.offset,source.offset+length));return true;},
      getBytesLength(destination,count){
        const bytes=source.buffer.slice(source.offset,source.offset+count);
        onPcm?.(bytes);
        if(!corruptCopy)new Uint8Array(destination.buffer,destination.offset,count).set(new Uint8Array(bytes));
      },
    }),dataWithBytesNoCopyLengthFreeWhenDone:(source,length)=>({source,length})},
    NSFileManager:{defaultManager:{fileExistsAtPath:path=>tempFiles.has(path),removeItemAtPathError:path=>tempFiles.delete(path)}},
    interop:{Reference:class{},handleof:pointer,bufferFromData:({source,length})=>source.buffer.slice(source.offset,source.offset+length)},
    setInterval:callback=>{const id=++serial;timers.set(id,callback);return id;},clearInterval:id=>timers.delete(id),
  };
  const {IosGameAudioHost}=loadTS('bridge/audio/game-audio.ios.ts',{'@nativescript/core':{knownFolders:{temp:()=>({path:'tmp'})},path:{join:(...p)=>p.join('/')}}},globals);
  const host=new IosGameAudioHost((...args)=>errors.push(args));
  return {host,engine:engines[0],session,nodes,connections,players,observers,timers,errors,tempFiles,references,
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
  assert.equal(f.session.active,false);
  await host.resume();f.session.outputNumberOfChannels=1;assert.equal(host.stereoPan,false);
  f.emit('interruption',{type:1});assert.equal(host.state,'interrupted');
  f.emit('interruption',{type:0,option:1});assert.equal(host.state,'running');
  voice.stop();voice.dispose();host.close();host.close();
  assert.equal(f.players[0].stops,1);assert.equal(f.nodes.size,0);
  assert.equal(f.errors.filter(([event])=>event==='ios-audio-interruption').length,2);
});

test('foreground retry clears a begun interruption with no ended event and ignores delayed background deactivation',async()=>{
  const f=fixture(),{host}=f;await host.resume();
  const voice=host.openVoice(host.createBuffer(1,2,48000),{bus:'ui',loop:true,frequency:1,gain:1,pan:0});
  voice.start(()=>assert.fail('Unexpected loop completion.'));
  f.emit('interruption',{type:1});f.players[0].playing=false;
  f.session.activationAllowed=false;
  await assert.rejects(host.resume(),/route unavailable \(123\)/);
  assert.equal(host.state,'interrupted');
  f.session.activationAllowed=true;
  await host.resume();
  assert.equal(host.state,'running');assert.equal(f.players[0].scheduleCount,2);
  f.emit('interruption',{type:1,reason:1});
  assert.equal(host.state,'running');assert.equal(f.players[0].scheduleCount,2);
  host.close();
});

test('direct PCM preserves nonzero stereo samples and the offline probe measures the prepared native buffer',async()=>{
  const f=fixture(),{host}=f;
  const buffer=host.createBuffer(2,2,44100.25);
  buffer.getChannelData(0).set([.5,-.75]);buffer.getChannelData(1).set([-.25,1]);
  host.prepareBuffer(buffer);
  assert.equal(f.tempFiles.size,0);
  const measurement=await host.measureCenterSignal(buffer);
  assert.equal(measurement.sampleRate,44100.25);
  assert.deepEqual(Array.from(measurement.inputPeak),[.75,1]);
  assert.ok(measurement.outputPeak.every(peak=>peak>.5));
  assert.equal(measurement.renderedFrames,4096);
  assert.equal(f.session.activations,0);
  assert.equal(f.nodes.size,12);
  host.close();assert.equal(f.nodes.size,0);
});

test('the optional hardware reference is released before graph playback or app suspension',async()=>{
  const f=fixture(),{host}=f;await host.resume();
  const buffer=host.createBuffer(1,2,48000);
  host.playReferenceTone(buffer);
  assert.equal(host.playbackSnapshot().referencePlaying,true);
  const voice=host.openVoice(buffer,{bus:'ui',loop:true,frequency:1,gain:1,pan:0});
  assert.equal(f.references[0].playing,false);
  voice.dispose();
  host.playReferenceTone(buffer);
  await host.suspend();
  assert.equal(f.references[1].playing,false);
  assert.equal(host.playbackSnapshot().referencePlaying,false);
  host.close();
});

test('a native frame mismatch reports exact metadata and leaves the independent reference playable',async()=>{
  const f=fixture({frameLengthDelta:-1}),{host}=f;
  const buffer=host.createBuffer(1,48,48000);
  assert.throws(()=>host.prepareBuffer(buffer),/Native PCM differs from the installed format/);
  const [event,result]=f.errors.at(-1);
  assert.equal(event,'ios-audio-pcm-format');
  assert.equal(result.status,'mismatch');
  assert.equal(result.expected.frames,48);
  assert.equal(result.source,'planar-float32');
  assert.equal(result.actual.frames,47);
  assert.equal(host.snapshot().buffers,0);
  assert.equal(f.tempFiles.size,0);
  await host.resume();
  host.playReferenceTone(buffer);
  assert.equal(host.playbackSnapshot().referencePlaying,true);
  host.close();
});

test('direct PCM copies typed-array slices and rejects silent native copies before installation',async()=>{
  const base=new Float32Array([.875,.25,-.5,.625]);
  const samples=base.subarray(1,3);
  const buffer={length:2,numberOfChannels:1,sampleRate:48000,duration:2/48000,getChannelData:()=>samples};
  const f=fixture(),{host}=f;
  host.prepareBuffer(buffer);
  await host.resume();
  const voice=host.openVoice(buffer,{bus:'ui',loop:true,frequency:1,gain:1,pan:0});
  voice.start(()=>assert.fail('Unexpected loop completion.'));
  assert.deepEqual(Array.from(new Float32Array(f.players[0].scheduled.buffer.floatChannelData[0].buffer)),[.25,-.5]);
  host.close();
  const bad=fixture({corruptCopy:true}).host;
  assert.throws(()=>bad.prepareBuffer(buffer),/Native PCM copy did not preserve channel 0/);
  assert.equal(bad.snapshot().buffers,0);
  bad.close();
});

test('numeric SDK representations are normalized before comparing exact PCM frame counts',async()=>{
  const f=fixture({bridgeFrameLength:true}),{host}=f;
  const buffer=host.createBuffer(1,32,48000);
  buffer.getChannelData(0)[0]=.5;
  host.prepareBuffer(buffer);
  const [,result]=f.errors.at(-1);
  assert.equal(result.status,'matched');
  assert.equal(result.actual.frames,32);
  assert.equal(result.actual.nativeTypes.frames,'bigint');
  const rendered=await host.measureCenterSignal(buffer);
  assert.deepEqual(Array.from(rendered.inputPeak),[.5]);
  host.close();
});

test('macOS AVAudioPCMBuffer preserves all generated 48 kHz mono and stereo PCM samples', {skip:process.platform!=='darwin'},()=>{
  const folder=mkdtempSync(join(tmpdir(),'g11-native-pcm-'));
  try{
    const inputs=[];
    const {host}=fixture({onPcm:bytes=>{
      const path=join(folder,'pcm-'+inputs.length+'.f32');
      writeFileSync(path,Buffer.from(bytes));inputs.push(path);
    }});
    for(const channels of [1,2]){
      const tone=host.createBuffer(channels,48000,48000);
      for(let channel=0;channel<channels;channel++){
        const samples=tone.getChannelData(channel);
        for(let i=0;i<samples.length;i++)samples[i]=.15*(channel+1)*Math.sin(2*Math.PI*440*i/48000);
      }
      host.prepareBuffer(tone);
    }
    host.close();
    const script=join(folder,'verify.swift');
    writeFileSync(script,String.raw`
import AVFoundation
import Darwin
import Foundation
let paths = Array(CommandLine.arguments.dropFirst())
guard paths.count == 3 else { exit(1) }
var index = 0
for channels in [1, 2] {
    guard let format = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: AVAudioChannelCount(channels)),
          let pcm = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 48000),
          let samples = pcm.floatChannelData else { exit(2) }
    pcm.frameLength = 48000
    let record = "AVAudioPCMBuffer \(pcm.frameCapacity) \(pcm.frameLength) \(pcm.format.channelCount) \(pcm.format.sampleRate)"
    FileHandle.standardOutput.write(Data((record + "\n").utf8))
    guard pcm.frameCapacity >= 48000, pcm.frameLength == 48000, Int(pcm.format.channelCount) == channels,
          pcm.format.sampleRate == 48000, pcm.stride == 1 else { exit(3) }
    for channel in 0..<channels {
        let data = try Data(contentsOf: URL(fileURLWithPath: paths[index])) as NSData
        index += 1
        let byteCount = 48000 * MemoryLayout<Float>.size
        guard data.length == byteCount else { exit(4) }
        data.getBytes(UnsafeMutableRawPointer(samples[channel]), length: byteCount)
        let nativeBytes = Data(bytes: UnsafeRawPointer(samples[channel]), count: byteCount)
        guard nativeBytes == (data as Data) else { exit(5) }
        for frame in 0..<48000 {
            let expected = Float(0.15 * Double(channel + 1) * sin(2 * Double.pi * 440 * Double(frame) / 48000))
            guard abs(samples[channel][frame] - expected) < 0.000001 else { exit(6) }
        }
    }
}
`);
    const output=execFileSync('xcrun',['swift',script,...inputs],{encoding:'utf8',timeout:120_000});
    assert.match(output,/AVAudioPCMBuffer 48000 48000 1 48000\.0/);
    assert.match(output,/AVAudioPCMBuffer 48000 48000 2 48000\.0/);
  }finally{rmSync(folder,{recursive:true,force:true});}
});
