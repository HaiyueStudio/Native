import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadTS} from './support/load-ts.mjs';

function fixture({onPcm,frameLengthDelta=0,bridgeFrameLength=false,corruptCopy=false,checkedStart=false,silentHot=false}={}){
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
  const makeEngine=()=>({
    mainMixerNode:mixer(),running:false,owned:new Set(),edges:new Map(),
    attachNode(node){nodes.add(node);this.owned.add(node);node.attachedHot=this.running;},
    connectToFormat(from,to,format){connections.push([from,to,format]);this.edges.set(from,to);from.outputFormatForBus=()=>format;},
    disconnectNodeOutput(node){connections.push(['disconnect',node]);this.edges.delete(node);},
    detachNode(node){nodes.delete(node);this.owned.delete(node);this.edges.delete(node);},
    outputConnectionPointsForNodeOutputBus(node){
      const to=this.edges.get(node);return {count:to?1:0,objectAtIndex:()=>({node:to,bus:0})};
    },
    enableManualRenderingModeFormatMaximumFrameCountError(_mode,format){this.manualRenderingFormat=format;return true;},
    renderOfflineToBufferError(frames,pcm){
      pcm.frameLength=frames;
      const player=players.find(node=>this.owned.has(node)&&node.playing&&!(silentHot&&node.attachedHot));
      for(const output of pcm.floatChannelData){
        const target=new Float32Array(output.buffer);
        if(!player){target.fill(0);continue;}
        const source=new Float32Array(player.scheduled.buffer.floatChannelData[0].buffer);
        for(let i=0;i<frames;i++)target[i]=source[i%source.length]/Math.sqrt(2);
      }
      return 0;
    },
    startAndReturnError(error){
      if(this.failStart){error.value={localizedDescription:'restart rejected'};return false;}
      this.running=true;return true;
    },
    prepare(){this.prepareCount=(this.prepareCount??0)+1;},
    pause(){this.running=false;},stop(){this.running=false;}});
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
      const player={lastRenderTime:{},now:0,playing:false,respondsToSelector:name=>name==='playAndReturnError:',
        playerTimeForNodeTime(){return {sampleTimeValid:true,sampleRate:48000,sampleTime:this.now};},
        scheduleBufferAtTimeOptionsCompletionHandler(buffer,when,options,callback){this.scheduleCount=(this.scheduleCount??0)+1;this.scheduled={buffer,when,options,callback};},
        play(){this.playing=true;},stop(){this.playing=false;this.stops=(this.stops??0)+1;}};
      if(checkedStart)player.playAndReturnError=error=>{
        if(checkedStart==='reject'){error.value={localizedDescription:'native start rejected',domain:'AVFAudio',code:-1};return false;}
        player.playing=true;return true;
      };
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
  assert.equal(measurement.cases.length,2);
  assert.ok(measurement.cases.every(result=>result.graph?.reachesMainMixer));
  assert.equal(measurement.cases.find(result=>result.id==='direct-cold').graph.edges.length,1);
  assert.equal(f.session.activations,0);
  assert.equal(f.nodes.size,12);
  host.close();assert.equal(f.nodes.size,0);
});

test('the offline probe uses the paused connection path and reports checked start errors',async()=>{
  for(const checkedStart of [true,'reject']){
    const {host,nodes}=fixture({checkedStart,silentHot:true});
    const buffer=host.createBuffer(1,2,48000);
    buffer.getChannelData(0).set([.25,-.5]);
    host.prepareBuffer(buffer);
    const {cases:[direct,paused]}=await host.measureCenterSignal(buffer);
    assert.deepEqual([direct.id,paused.id],['direct-cold','full-paused']);
    assert.equal(paused.startApi,'playAndReturnError');
    if(checkedStart==='reject'){
      for(const result of [direct,paused]){
        assert.equal(result.stage,'start-player');
        assert.match(result.error,/native start rejected \(AVFAudio -1\)/);
      }
    }else{
      assert.ok(paused.outputPeak.every(peak=>peak>0));
      assert.ok(direct.outputPeak.every(peak=>peak>0));
    }
    assert.equal(nodes.size,12);
    host.close();assert.equal(nodes.size,0);
  }
});

test('voice graph edits preserve an existing schedule and reject a disconnected start or failed restart',async()=>{
  const {host,engine,session,nodes,players,timers}=fixture();
  const buffer=host.createBuffer(1,48000,48000);
  const options={bus:'ui',loop:false,frequency:1,gain:1,pan:0};
  await host.resume();
  const first=host.openVoice(buffer,options);
  first.start(()=>assert.fail('The live voice must not finish during graph edits.'));
  const second=host.openVoice(buffer,options);
  assert.equal(players[0].scheduleCount,1);
  assert.equal(players[0].playing,true);
  assert.ok(players.every(player=>!player.attachedHot));
  assert.equal(engine.prepareCount,2);
  engine.edges.delete(players[1]);
  assert.throws(()=>second.start(()=>{}),/without a running route/);
  assert.equal(players[1].scheduleCount,undefined);
  second.dispose();
  assert.equal(timers.size,1);
  engine.failStart=true;
  assert.throws(()=>host.openVoice(buffer,options),/restart rejected/);
  assert.equal(host.state,'suspended');
  assert.equal(session.active,false);
  assert.equal(host.snapshot().voices,1);
  engine.failStart=false;
  await host.resume();
  assert.equal(host.state,'running');
  assert.equal(players[0].scheduleCount,1);
  host.close();
  assert.equal(nodes.size,0);
});

test('a rejected native loop restart leaves the host suspended and permits a later retry',async()=>{
  const {host,session,players}=fixture({checkedStart:true});
  await host.resume();
  const voice=host.openVoice(host.createBuffer(1,2,48000),{bus:'ui',loop:true,frequency:1,gain:1,pan:0});
  voice.start(()=>assert.fail('A loop must not finish by polling.'));
  await host.suspend();
  const [player]=players;
  player.playing=false;
  const play=player.playAndReturnError;
  player.playAndReturnError=()=>false;
  await assert.rejects(host.resume(),/rejected playback/);
  assert.equal(host.state,'suspended');
  assert.equal(session.active,false);
  player.playAndReturnError=play;
  await host.resume();
  assert.equal(host.state,'running');
  assert.equal(player.playing,true);
  host.close();
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

function runMacAudioGraphCases(transitionProbe){
  const folder=mkdtempSync(join(tmpdir(),'g11-native-signal-'));
  try{
    const script=join(folder,'signal.swift');
    writeFileSync(script,String.raw`
import AVFoundation
import Foundation

struct Signal: Codable {
    let id: String
    let outputPeak: [Float]
    let renderedFrames: Int
    let playing: Bool
    let sampleTime: Int64?
    let anchorBeforeEdit: Int64?
    let anchorAfterEdit: Int64?
    let anchorStillPlaying: Bool?
}

func emit<T: Encodable>(_ value: T) throws {
    let json = try JSONEncoder().encode(value)
    FileHandle.standardOutput.write(json)
    FileHandle.standardOutput.write(Data([10]))
}

struct Route: Codable {
    let id: String
    let stage: String
    let reachesMain: Bool
    let reachesOutput: Bool
    let playerOutputChannels: UInt32
    let playerOutputRate: Double
    let path: [String]
}

func measure(id: String) throws -> Signal {
    let direct = id == "direct-cold"
    let paused = id == "full-paused"
    let stopped = id == "full-stopped-reconnect"
    let prewiredSink = ["prewired-sink-hot", "prewired-effects-hot", "prewired-player"].contains(id)
    let prewiredEffects = ["prewired-effects-hot", "prewired-player"].contains(id)
    let prewiredPlayer = id == "prewired-player"
    let connectBusLast = id == "late-bus-connect-hot"
    let transitionProbe = stopped || prewiredSink || connectBusLast
    let hot = id == "full-hot" || paused || transitionProbe
    let configureFirst = id == "full-before-manual"
    let engine = AVAudioEngine()
    let player = AVAudioPlayerNode()
    let mono = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 1)!
    let stereo = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 2)!
    let tone = AVAudioPCMBuffer(pcmFormat: mono, frameCapacity: 48000)!
    tone.frameLength = 48000
    let samples = tone.floatChannelData![0]
    for frame in 0..<Int(tone.frameLength) {
        samples[frame] = Float(0.15 * sin(2 * Double.pi * 440 * Double(frame) / 48000))
    }

    var labels: [ObjectIdentifier: String] = [ObjectIdentifier(player): "player"]
    func eq(_ label: String) -> AVAudioUnitEQ {
        let node = AVAudioUnitEQ(numberOfBands: 1)
        node.bands[0].bypass = true
        engine.attach(node)
        labels[ObjectIdentifier(node)] = label
        return node
    }
    func mixer(_ label: String) -> AVAudioMixerNode {
        let node = AVAudioMixerNode()
        engine.attach(node)
        labels[ObjectIdentifier(node)] = label
        return node
    }
    func level(_ name: String) -> (input: AVAudioMixerNode, output: AVAudioMixerNode) {
        let filter = eq(name + "-eq"), output = mixer(name + "-out"), input = mixer(name + "-in")
        engine.connect(input, to: filter, format: stereo)
        engine.connect(filter, to: output, format: stereo)
        return (input, output)
    }

    let main = engine.mainMixerNode
    labels[ObjectIdentifier(main)] = "main"
    var ui: AVAudioMixerNode?
    if !direct {
        let master = level("master")
        engine.connect(master.output, to: main, format: stereo)
        for bus in ["music", "sfx", "ui"] {
            let busLevel = level(bus)
            engine.connect(busLevel.output, to: master.input, format: stereo)
            if bus == "ui" { ui = busLevel.input }
        }
    }
    var voiceSink: AVAudioMixerNode?
    if prewiredSink, let ui {
        let output = mixer("voice-out")
        engine.connect(output, to: ui, format: stereo)
        output.outputVolume = 1
        output.pan = 0
        voiceSink = output
    }
    var voiceFilter: AVAudioUnitEQ?
    if prewiredEffects, let voiceSink {
        let filter = eq("voice-eq")
        engine.connect(filter, to: voiceSink, format: mono)
        voiceFilter = filter
    }
    if prewiredPlayer, let voiceFilter {
        engine.attach(player)
        engine.connect(player, to: voiceFilter, format: mono)
    }
    var anchor: AVAudioPlayerNode?
    if transitionProbe, let ui {
        let existing = AVAudioPlayerNode()
        engine.attach(existing)
        engine.connect(existing, to: ui, format: mono)
        existing.volume = 0.04
        anchor = existing
    }
    func sampleTime(_ node: AVAudioPlayerNode) -> Int64? {
        let clock = node.lastRenderTime.flatMap { node.playerTime(forNodeTime: $0) }
        return clock?.isSampleTimeValid == true ? clock?.sampleTime : nil
    }
    var anchorBefore: Int64?
    if !direct && !configureFirst {
        try engine.enableManualRenderingMode(.offline, format: stereo, maximumFrameCount: 1024)
    }
    if hot {
        try engine.start()
        if let anchor {
            anchor.scheduleBuffer(tone, at: nil, options: .loops, completionHandler: nil)
            anchor.play()
            let warm = AVAudioPCMBuffer(pcmFormat: engine.manualRenderingFormat, frameCapacity: 1024)!
            for _ in 0..<2 { _ = try engine.renderOffline(1024, to: warm) }
            anchorBefore = sampleTime(anchor)
        }
        if paused { engine.pause() }
        if stopped { engine.stop() }
    }
    if !prewiredPlayer {
        engine.attach(player)
        if let ui {
            let output = voiceSink ?? mixer("voice-out")
            if voiceSink == nil && !connectBusLast { engine.connect(output, to: ui, format: stereo) }
            let filter = voiceFilter ?? eq("voice-eq")
            if paused || transitionProbe {
                if voiceFilter == nil { engine.connect(filter, to: output, format: mono) }
                engine.connect(player, to: filter, format: mono)
            } else {
                engine.connect(player, to: filter, format: mono)
                engine.connect(filter, to: output, format: mono)
            }
            if connectBusLast { engine.connect(output, to: ui, format: stereo) }
            output.outputVolume = 1
            output.pan = 0
        } else {
            engine.connect(player, to: main, format: mono)
        }
    }
    if direct || configureFirst {
        try engine.enableManualRenderingMode(.offline, format: stereo, maximumFrameCount: 1024)
    }
    if !hot || paused || stopped {
        if paused || stopped { engine.prepare() }
        try engine.start()
    }
    defer { player.stop(); anchor?.stop(); engine.stop() }
    var node: AVAudioNode = player
    var reachesMain = false
    var path: [String] = []
    let outputNode = engine.outputNode
    labels[ObjectIdentifier(outputNode)] = "output"
    for _ in 0..<16 {
        path.append(labels[ObjectIdentifier(node)] ?? String(describing: type(of: node)))
        if node === main { reachesMain = true }
        if node === outputNode { break }
        let next = engine.outputConnectionPoints(for: node, outputBus: 0)
        guard next.count == 1, let target = next[0].node else { break }
        node = target
    }
    let format = player.outputFormat(forBus: 0)
    try emit(Route(id: id, stage: "before-play", reachesMain: reachesMain, reachesOutput: node === outputNode,
                   playerOutputChannels: format.channelCount, playerOutputRate: format.sampleRate, path: path))
    if transitionProbe && !reachesMain {
        return Signal(id: id, outputPeak: [0, 0], renderedFrames: 0, playing: false, sampleTime: nil,
                      anchorBeforeEdit: anchorBefore, anchorAfterEdit: anchor.flatMap { sampleTime($0) },
                      anchorStillPlaying: anchor?.isPlaying)
    }
    player.scheduleBuffer(tone, at: nil, options: .loops, completionHandler: nil)
    player.play()
    let buffer = AVAudioPCMBuffer(pcmFormat: engine.manualRenderingFormat, frameCapacity: 1024)!
    var peaks: [Float] = [0, 0]
    var rendered = 0
    for _ in 0..<8 {
        guard rendered < 4096 else { break }
        if try engine.renderOffline(1024, to: buffer) != .success { continue }
        rendered += Int(buffer.frameLength)
        for channel in 0..<2 {
            for frame in 0..<Int(buffer.frameLength) {
                peaks[channel] = max(peaks[channel], abs(buffer.floatChannelData![channel][frame]))
            }
        }
    }
    return Signal(id: id, outputPeak: peaks, renderedFrames: rendered, playing: player.isPlaying,
                  sampleTime: sampleTime(player), anchorBeforeEdit: anchorBefore,
                  anchorAfterEdit: anchor.flatMap { sampleTime($0) }, anchorStillPlaying: anchor?.isPlaying)
}

try emit(measure(id: CommandLine.arguments[1]))
`);
    const executable=join(folder,'native-audio-signal');
    execFileSync('xcrun',['swiftc',script,'-o',executable],{encoding:'utf8',timeout:120_000});
    const cases=(transitionProbe
      ? ['direct-cold','late-bus-connect-hot','prewired-sink-hot','prewired-effects-hot','prewired-player','full-stopped-reconnect']
      : ['direct-cold','full-cold','full-hot','full-before-manual','full-paused']).map(id=>{
      const run=spawnSync(executable,[id],{encoding:'utf8',timeout:30_000});
      const rows=(run.stdout??'').split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
      const route=rows.find(row=>row.id===id&&row.stage==='before-play');
      const result=rows.find(row=>row.id===id&&Array.isArray(row.outputPeak));
      if(run.status===0&&result){
        if(!transitionProbe||id==='direct-cold')return {id,route,...result};
        const signalPresent=result.renderedFrames===4096&&result.playing&&result.outputPeak.every(peak=>peak>.02);
        const existingVoiceContinued=result.renderedFrames===4096&&result.anchorStillPlaying&&Number.isFinite(result.anchorBeforeEdit)&&
          Number.isFinite(result.anchorAfterEdit)&&result.anchorAfterEdit>=result.anchorBeforeEdit+result.renderedFrames;
        return {id,route,...result,signalPresent,existingVoiceContinued:Boolean(existingVoiceContinued)};
      }
      const reason=run.stderr?.split('\n').find(line=>line.includes('reason:'))??run.stderr?.trim().split('\n')[0];
      return {id,route,status:run.status,signal:run.signal,error:run.error?.message??reason};
    });
    const label=transitionProbe?'macOS AVAudioEngine transition comparison':'macOS AVAudioEngine signal comparison';
    console.log(label,JSON.stringify(cases));
    for(const result of transitionProbe?[cases[0]]:[cases[0],cases.at(-1)]){
      assert.equal(result.route?.reachesMain,true,JSON.stringify(result));
      assert.equal(result.renderedFrames,4096,JSON.stringify(result));
      assert.ok(result.playing&&result.outputPeak.every(peak=>peak>.001),JSON.stringify(result));
    }
  }finally{rmSync(folder,{recursive:true,force:true});}
}

test('macOS AVAudioEngine graph transition probe', {skip:process.platform!=='darwin'},()=>{
  runMacAudioGraphCases(true);
});

test('macOS AVAudioEngine renders the direct and paused routes while preserving legacy graph outcomes', {
  skip:process.platform!=='darwin'||process.env.G11_AUDIO_GRAPH_PROBE==='1',
},()=>{
  runMacAudioGraphCases(false);
});
