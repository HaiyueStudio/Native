import {knownFolders,path} from '@nativescript/core';
import type {AudioMixerBus,OwnerSafeAudioMixerOptions} from '@haiyue/engine/audio';

type AudioMixerHost=NonNullable<OwnerSafeAudioMixerOptions['host']>;
type AudioMixerHostVoice=ReturnType<AudioMixerHost['openVoice']>;

const buses:readonly AudioMixerBus[]=['music','sfx','ui'];
const maxFrames=10_000_000;
let decodeSequence=0;

function validatePcm(channels:number,frames:number,rate:number):void{
  if(![1,2].includes(channels)||!Number.isSafeInteger(frames)||frames<1||frames>maxFrames||
    !Number.isFinite(rate)||rate<8000||rate>192000)throw new RangeError('Invalid iOS PCM format.');
}

interface PcmShape {frames:number;channels:number;sampleRate:number;}
type SignalCase='full-paused'|'direct-cold';

function describePcm(frames:number,format:AVAudioFormat){
  const {channelCount,sampleRate}=format;
  return {frames:Number(frames),channels:Number(channelCount),sampleRate:Number(sampleRate),
    nativeTypes:{frames:typeof frames,channels:typeof channelCount,sampleRate:typeof sampleRate}};
}

function samePcm(left:PcmShape,right:PcmShape):boolean{
  return left.frames===right.frames&&left.channels===right.channels&&left.sampleRate===right.sampleRate;
}

function canCheckPlayerStart(player:AVAudioPlayerNode):player is AVAudioPlayerNode&{
  playAndReturnError(error:interop.Reference<NSError>):boolean;
}{
  return typeof (player as AVAudioPlayerNode&{playAndReturnError?:unknown}).playAndReturnError==='function'&&
    player.respondsToSelector('playAndReturnError:');
}

function startPlayer(engine:AVAudioEngine,player:AVAudioPlayerNode,pcm:AVAudioPCMBuffer,loop:boolean):void{
  if(!engine.running||!inspectPlayerPath(engine,player).reachesMainMixer){
    throw new Error('Cannot start an iOS audio player without a running route to the main mixer.');
  }
  player.scheduleBufferAtTimeOptionsCompletionHandler(pcm,null as unknown as AVAudioTime,
    loop?AVAudioPlayerNodeBufferOptions.Loops:0 as AVAudioPlayerNodeBufferOptions,null as unknown as ()=>void);
  if(canCheckPlayerStart(player)){
    const error=new interop.Reference<NSError>();
    if(!player.playAndReturnError(error)){
      const reason=error.value;
      player.stop();
      throw new Error(reason?'AVAudioPlayerNode: '+reason.localizedDescription+' ('+reason.domain+' '+reason.code+')':
        'AVAudioPlayerNode rejected playback without an NSError.');
    }
    return;
  }
  player.play();
}

function playerClock(player:AVAudioPlayerNode){
  const time=player.lastRenderTime,clock=time?player.playerTimeForNodeTime(time):null;
  return {playing:player.playing,nodeSampleTime:time?.sampleTimeValid?Number(time.sampleTime):null,
    sampleTime:clock?.sampleTimeValid?Number(clock.sampleTime):null};
}

function inspectPlayerPath(engine:AVAudioEngine,player:AVAudioPlayerNode){
  const edges:{inputBus:number;channels:number;sampleRate:number}[]=[];
  const visited=new Set<AVAudioNode>();
  const main=engine.mainMixerNode;
  const isMain=(node:AVAudioNode)=>node===main||node.isEqual?.(main)===true;
  let node:AVAudioNode=player;
  while(!visited.has(node)&&!isMain(node)&&edges.length<16){
    visited.add(node);
    const points=engine.outputConnectionPointsForNodeOutputBus(node,0);
    if(Number(points.count)!==1)break;
    const connection=points.objectAtIndex(0);
    if(!connection.node)break;
    const format=node.outputFormatForBus(0);
    edges.push({inputBus:Number(connection.bus),channels:Number(format.channelCount),sampleRate:Number(format.sampleRate)});
    node=connection.node;
  }
  return {reachesMainMixer:isMain(node),edges};
}

class PcmBuffer implements AudioBuffer {
  private readonly channels:Float32Array<ArrayBuffer>[];
  constructor(readonly numberOfChannels:number,readonly length:number,readonly sampleRate:number){
    validatePcm(numberOfChannels,length,sampleRate);
    this.channels=Array.from({length:numberOfChannels},()=>new Float32Array(length));
  }
  get duration():number{return this.length/this.sampleRate;}
  getChannelData(channel:number):Float32Array<ArrayBuffer>{
    const data=this.channels[channel];
    if(!data)throw new RangeError('PCM channel is out of range.');
    return data;
  }
  copyFromChannel(destination:Float32Array,channel:number,offset=0):void{
    destination.set(this.getChannelData(channel).subarray(offset,offset+destination.length));
  }
  copyToChannel(source:Float32Array,channel:number,offset=0):void{
    const destination=this.getChannelData(channel);
    destination.set(source.subarray(0,destination.length-offset),offset);
  }
}

function pcmChannel(buffer:AVAudioPCMBuffer,channel:number):interop.Pointer|interop.Reference<number>{
  // NativeScript represents the SDK's float** as an indexed Reference.
  const channels=buffer.floatChannelData as unknown as Readonly<Record<number,interop.Pointer|interop.Reference<number>|undefined>>;
  const pointer=channels?.[channel];
  if(!pointer)throw new Error('AVAudioPCMBuffer did not expose a Float32 channel.');
  return pointer;
}

function readSamples(buffer:AVAudioPCMBuffer,channel:number):Float32Array{
  const data=NSData.dataWithBytesNoCopyLengthFreeWhenDone(pcmChannel(buffer,channel),Number(buffer.frameLength)*4,false);
  return new Float32Array(interop.bufferFromData(data));
}

function encodeReferenceWav(buffer:AudioBuffer):ArrayBuffer{
  const {length,sampleRate}=buffer;
  if(buffer.numberOfChannels!==1||!Number.isSafeInteger(sampleRate))throw new Error('The iOS reference tone requires mono PCM and an integer sample rate.');
  validatePcm(1,length,sampleRate);
  const size=length*2,wav=new ArrayBuffer(44+size),view=new DataView(wav);
  view.setUint32(0,0x52494646);view.setUint32(4,36+size,true);view.setUint32(8,0x57415645); // RIFF/WAVE
  view.setUint32(12,0x666d7420);view.setUint32(16,16,true);view.setUint16(20,1,true); // fmt / PCM
  view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);
  view.setUint16(32,2,true);view.setUint16(34,16,true);
  view.setUint32(36,0x64617461);view.setUint32(40,size,true); // data
  const samples=buffer.getChannelData(0);
  for(let i=0;i<length;i++)view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,samples[i]!))*32767),true);
  return wav;
}

interface Level {
  readonly input:AVAudioNode;
  readonly output:AVAudioMixerNode;
  setGain(value:number):void;
}
interface VoiceOutput {
  readonly node:AVAudioMixerNode;
  bus:AudioMixerBus|null;
  inUse:boolean;
}

/** AVAudioEngine graph for the shared Engine mixer. The app owns one instance per audio session. */
export class IosGameAudioHost implements AudioMixerHost {
  private readonly engine=AVAudioEngine.new();
  private readonly session=AVAudioSession.sharedInstance();
  private readonly stereoFormat:AVAudioFormat;
  private readonly outputNodes:AVAudioNode[]=[];
  private readonly observers:NSObjectProtocol[]=[];
  private readonly busLevels=new Map<AudioMixerBus,Level>();
  private readonly master:Level;
  private readonly voiceOutputs:VoiceOutput[]=[];
  private readonly voiceDisposers=new Set<()=>void>();
  private readonly finiteVoices=new Map<AVAudioPlayerNode,{duration:number;end:()=>void}>();
  private readonly loops=new Map<AVAudioPlayerNode,()=>void>();
  private readonly preparedBuffers=new Map<AudioBuffer,{pcm:AVAudioPCMBuffer;refs:number}>();
  private referencePlayer:AVAudioPlayer|null=null;
  private timer:ReturnType<typeof setInterval>|undefined;
  private mode:AudioMixerHost['state']='suspended';
  private interruption=false;
  private reactivate=false;
  private active=false;
  private editingGraph=false;

  constructor(private readonly report:(event:string,detail:unknown)=>void=()=>{},private readonly maxVoices=128,
    private readonly offlineRate?:number){
    try{
      if(!Number.isSafeInteger(maxVoices)||maxVoices<1||maxVoices>1024)throw new RangeError('Invalid iOS audio voice capacity.');
      if(this.offlineRate===undefined&&!this.session.setCategoryError(AVAudioSessionCategoryAmbient))throw new Error('Unable to set the iOS ambient audio category.');
      this.stereoFormat=AVAudioFormat.alloc().initStandardFormatWithSampleRateChannels(this.sampleRate,2);
      this.master=this.addLevel();
      this.engine.connectToFormat(this.master.output,this.engine.mainMixerNode,this.stereoFormat);
      for(const bus of buses){
        const level=this.addLevel();
        this.engine.connectToFormat(level.output,this.master.input,this.stereoFormat);
        this.busLevels.set(bus,level);
      }
      if(this.offlineRate!==undefined){
        if(!this.engine.enableManualRenderingModeFormatMaximumFrameCountError(AVAudioEngineManualRenderingMode.Offline,this.stereoFormat,1024)){
          throw new Error('Unable to enable iOS offline audio rendering.');
        }
        return;
      }
      this.observe(AVAudioSessionInterruptionNotification,null,notification=>{
        const info=notification.userInfo;
        const type=Number(info?.objectForKey(AVAudioSessionInterruptionTypeKey));
        const reason=Number(info?.objectForKey(AVAudioSessionInterruptionReasonKey));
        const wasSuspended=Boolean(Number(info?.objectForKey(AVAudioSessionInterruptionWasSuspendedKey)))||
          reason===AVAudioSessionInterruptionReason.AppWasSuspended;
        this.report('ios-audio-interruption',{type,reason:Number.isFinite(reason)?reason:null,wasSuspended,state:this.state});
        if(type===AVAudioSessionInterruptionType.Began){
          // iOS can deliver the background deactivation after foreground
          // recovery has already reactivated the current session.
          if(wasSuspended&&this.active&&this.state==='running')return;
          this.reactivate=this.reactivate||this.mode==='running';
          this.active=false;
          this.interruption=!wasSuspended;
          this.pause(wasSuspended?'suspended':'interrupted');
        }else if(type===AVAudioSessionInterruptionType.Ended){
          if(!this.interruption)return;
          this.interruption=false;
          const options=Number(notification.userInfo?.objectForKey(AVAudioSessionInterruptionOptionKey));
          const reactivate=this.reactivate&&(options&AVAudioSessionInterruptionOptions.ShouldResume)!==0;
          this.reactivate=false;this.mode='suspended';
          if(reactivate)void this.resume().catch(error=>this.report('ios-audio-error',{reason:String(error)}));
        }
      });
      this.observe(AVAudioSessionRouteChangeNotification,null,notification=>{
        const reason=Number(notification.userInfo?.objectForKey(AVAudioSessionRouteChangeReasonKey));
        if(reason===AVAudioSessionRouteChangeReason.OldDeviceUnavailable&&this.mode==='running')this.pause('suspended');
      });
      this.observe(AVAudioEngineConfigurationChangeNotification,this.engine,()=>{
        if(!this.editingGraph&&this.mode==='running'&&!this.engine.running)this.pause('suspended');
      });
    }catch(error){this.close();throw error;}
  }

  get state():AudioMixerHost['state']{
    return this.mode==='running'&&!this.engine.running?'suspended':this.mode;
  }
  get sampleRate():number{return this.offlineRate??(this.session.sampleRate||48000);}
  get stereoPan():boolean{return this.state==='running'&&(this.offlineRate!==undefined||this.session.outputNumberOfChannels>=2);}
  get nodeCount():number{return this.outputNodes.length;}

  createBuffer(channels:number,frames:number,rate:number):AudioBuffer{return new PcmBuffer(channels,frames,rate);}

  async decodeAudioData(bytes:ArrayBuffer):Promise<AudioBuffer>{
    this.assertOpen();
    if(bytes.byteLength>64*1024*1024)throw new RangeError('iOS encoded audio exceeds 64 MiB.');
    const pcm=this.readNativeFile(bytes);
    const {channels,frames,sampleRate}=describePcm(pcm.frameLength,pcm.format);
    const result=new PcmBuffer(channels,frames,sampleRate);
    for(let channel=0;channel<result.numberOfChannels;channel++)result.getChannelData(channel).set(readSamples(pcm,channel));
    return result;
  }

  private readNativeFile(bytes:ArrayBuffer):AVAudioPCMBuffer{
    const name=`haiyue-game-audio-${Date.now()}-${++decodeSequence}`;
    const filePath=path.join(knownFolders.temp().path,name),url=NSURL.fileURLWithPath(filePath);
    const data=NSData.dataWithBytesLength(interop.handleof(bytes),bytes.byteLength);
    try{
      if(!data.writeToURLOptionsError(url,0 as NSDataWritingOptions))throw new Error('Unable to stage iOS audio bytes.');
      const error=new interop.Reference<NSError>();
      const file=AVAudioFile.alloc().initForReadingCommonFormatInterleavedError(url,AVAudioCommonFormat.PCMFormatFloat32,false,error);
      if(!file)throw new Error(`AVAudioFile could not open the encoded audio${error.value?': '+error.value.localizedDescription:'.'}`);
      const {processingFormat}=file,source=describePcm(file.length,processingFormat);
      const {frames,channels,sampleRate}=source;
      validatePcm(channels,frames,sampleRate);
      const pcm=AVAudioPCMBuffer.alloc().initWithPCMFormatFrameCapacity(processingFormat,frames);
      if(!pcm)throw new Error('Unable to allocate an iOS PCM buffer.');
      if(!file.readIntoBufferError(pcm,error))throw new Error(`Unable to decode iOS audio${error.value?': '+error.value.localizedDescription:'.'}`);
      const actual=describePcm(pcm.frameLength,pcm.format);
      validatePcm(actual.channels,actual.frames,actual.sampleRate);
      return pcm;
    }finally{
      const fs=NSFileManager.defaultManager;
      if(fs.fileExistsAtPath(filePath))fs.removeItemAtPathError(filePath);
    }
  }

  prepareBuffer(buffer:AudioBuffer):void{
    this.assertOpen();
    const previous=this.preparedBuffers.get(buffer);
    this.preparedBuffers.set(buffer,{pcm:this.toNativePcm(buffer),refs:(previous?.refs??0)+1});
  }

  async measureCenterSignal(buffer:AudioBuffer){
    this.assertOpen();
    const pcm=this.preparedBuffers.get(buffer)?.pcm;
    if(!pcm)throw new Error('Install the test PCM before measuring its signal.');
    const {channels,sampleRate}=describePcm(pcm.frameLength,pcm.format);
    const inputPeak=Array.from({length:channels},(_,channel)=>signalPeak(readSamples(pcm,channel)));
    const direct=await this.measureSignalCase('direct-cold',buffer,pcm,sampleRate);
    this.report('ios-audio-signal-case',direct);
    const full=await this.measureSignalCase('full-paused',buffer,pcm,sampleRate);
    this.report('ios-audio-signal-case',full);
    const {outputPeak,renderedFrames,statuses}=full;
    return {sampleRate,inputPeak,outputPeak,renderedFrames,statuses,cases:[direct,full]};
  }

  private async measureSignalCase(id:SignalCase,buffer:AudioBuffer,pcm:AVAudioPCMBuffer,sampleRate:number){
    const direct=id==='direct-cold';
    let offline:IosGameAudioHost|undefined,engine:AVAudioEngine|undefined,player:AVAudioPlayerNode|undefined;
    let stage='create-engine',startApi:string|null=null;
    const outputPeak=[0,0],statuses:number[]=[];
    let renderedFrames=0;
    try{
      if(direct){
        engine=AVAudioEngine.new();
        player=AVAudioPlayerNode.new();
        stage='connect-player';
        engine.attachNode(player);
        engine.connectToFormat(player,engine.mainMixerNode,pcm.format);
        stage='start-engine';
        const format=AVAudioFormat.alloc().initStandardFormatWithSampleRateChannels(sampleRate,2);
        const error=new interop.Reference<NSError>();
        if(!engine.enableManualRenderingModeFormatMaximumFrameCountError(AVAudioEngineManualRenderingMode.Offline,format,1024)||
          !engine.startAndReturnError(error))throw new Error(error.value?.localizedDescription??'Unable to start the direct offline graph.');
        stage='start-player';
        startApi=canCheckPlayerStart(player)?'playAndReturnError':'play';
        startPlayer(engine,player,pcm,true);
      }else{
        offline=new IosGameAudioHost(this.report,1,sampleRate);
        engine=offline.engine;
        offline.preparedBuffers.set(buffer,{pcm,refs:1});
        stage='start-engine';
        await offline.resume();
        stage='connect-player';
        const prepared=offline.connectVoice(buffer,{bus:'ui',loop:true,frequency:1,gain:1,pan:0});
        player=prepared.player;
        stage='start-player';
        startApi=canCheckPlayerStart(player)?'playAndReturnError':'play';
        prepared.voice.start(()=>{});
      }
      stage='render';
      const rendered=AVAudioPCMBuffer.alloc().initWithPCMFormatFrameCapacity(engine.manualRenderingFormat,1024);
      for(let attempt=0;attempt<8&&renderedFrames<4096;attempt++){
        const status=Number(engine.renderOfflineToBufferError(1024,rendered));
        statuses.push(status);
        if(status===AVAudioEngineManualRenderingStatus.Error)break;
        if(status!==AVAudioEngineManualRenderingStatus.Success)continue;
        renderedFrames+=Number(rendered.frameLength);
        for(let channel=0;channel<2;channel++)outputPeak[channel]=Math.max(outputPeak[channel]!,signalPeak(readSamples(rendered,channel)));
      }
      stage='inspect-graph';
      const graph=inspectPlayerPath(engine,player);
      return {id,startApi,outputPeak,renderedFrames,statuses,clock:playerClock(player),graph};
    }catch(error){
      return {id,stage,startApi,error:String(error),outputPeak,renderedFrames,statuses};
    }finally{
      if(offline)offline.close();
      else if(engine){player?.stop();engine.stop();if(player)engine.detachNode(player);}
    }
  }

  playReferenceTone(buffer:AudioBuffer):void{
    this.assertOpen();
    if(this.state!=='running')throw new Error('The iOS audio session must be active for the reference tone.');
    this.stopReference();
    const bytes=encodeReferenceWav(buffer),data=NSData.dataWithBytesLength(interop.handleof(bytes),bytes.byteLength);
    const error=new interop.Reference<NSError>();
    const player=AVAudioPlayer.alloc().initWithDataError(data,error);
    if(!player||!player.play())throw new Error(`Unable to start the iOS reference tone${error.value?': '+error.value.localizedDescription:'.'}`);
    this.referencePlayer=player;
  }

  releaseBuffer(buffer:AudioBuffer):void{
    const entry=this.preparedBuffers.get(buffer);
    if(entry&&--entry.refs===0)this.preparedBuffers.delete(buffer);
  }

  private toNativePcm(buffer:AudioBuffer):AVAudioPCMBuffer{
    const {length:frames,numberOfChannels:channels,sampleRate}=buffer;
    validatePcm(channels,frames,sampleRate);
    const format=AVAudioFormat.alloc().initStandardFormatWithSampleRateChannels(sampleRate,channels);
    const pcm=AVAudioPCMBuffer.alloc().initWithPCMFormatFrameCapacity(format,frames);
    const capacity=Number(pcm?.frameCapacity);
    if(!Number.isSafeInteger(capacity)||capacity<frames)throw new Error('Unable to allocate the full iOS PCM buffer.');
    pcm.frameLength=frames;
    const expected={frames,channels,sampleRate},actual=describePcm(pcm.frameLength,pcm.format);
    const details={source:'planar-float32',expected,actual,stride:Number(pcm.stride)};
    if(!samePcm(actual,expected)||details.stride!==1){
      this.report('ios-audio-pcm-format',{status:'mismatch',...details});
      throw new Error('Native PCM differs from the installed format: '+JSON.stringify(details));
    }
    for(let channel=0;channel<channels;channel++){
      const samples=buffer.getChannelData(channel);
      if(samples.length!==frames)throw new Error('Invalid iOS voice PCM channel.');
      const {byteOffset,byteLength}=samples;
      const input=NSData.dataWithBytesLength(interop.handleof(samples.buffer).add(byteOffset),byteLength);
      input.getBytesLength(pcmChannel(pcm,channel),byteLength);
      const copied=readSamples(pcm,channel);
      const sourceBits=new Uint32Array(samples.buffer,byteOffset,frames);
      const nativeBits=new Uint32Array(copied.buffer,copied.byteOffset,copied.length);
      if(nativeBits.length!==frames||sourceBits.some((bits,frame)=>bits!==nativeBits[frame])){
        throw new Error(`Native PCM copy did not preserve channel ${channel}.`);
      }
    }
    this.report('ios-audio-pcm-format',{status:'matched',copyVerified:true,...details});
    return pcm;
  }

  openVoice(buffer:AudioBuffer,options:Parameters<AudioMixerHost['openVoice']>[1]):AudioMixerHostVoice{
    this.assertOpen();
    if(this.state!=='running')throw new Error('The iOS audio engine is suspended.');
    this.stopReference();
    return this.connectVoice(buffer,options).voice;
  }

  private connectVoice(buffer:AudioBuffer,options:Parameters<AudioMixerHost['openVoice']>[1]){
    const pcm=this.preparedBuffers.get(buffer)?.pcm??this.toNativePcm(buffer);
    let prepared:ReturnType<IosGameAudioHost['createVoice']>|undefined;
    try{return this.editGraph(()=>prepared=this.createVoice(pcm,buffer.duration,options));}
    catch(error){prepared?.voice.dispose();throw error;}
  }

  private createVoice(pcm:AVAudioPCMBuffer,duration:number,options:Parameters<AudioMixerHost['openVoice']>[1]){
    const format=pcm.format;
    const player=AVAudioPlayerNode.new(),nodes:AVAudioNode[]=[];
    const output=this.takeVoiceOutput(options.bus);
    let disposed=false,started=false;
    const play=()=>startPlayer(this.engine,player,pcm,options.loop);
    const dispose=()=>{
      if(disposed)return;
      disposed=true;
      this.finiteVoices.delete(player);this.updateTimer();
      this.loops.delete(player);
      this.voiceDisposers.delete(dispose);
      try{
        this.editGraph(()=>{try{if(started)player.stop();}finally{this.detach(nodes);}});
      }finally{output.inUse=false;}
    };
    try{
      this.attach(nodes,player);
      if(options.frequency!==1){
        const split=options.frequency<.25||options.frequency>4;
        const rate=split?Math.sqrt(options.frequency):options.frequency;
        for(let i=0;i<(split?2:1);i++){
          const speed=AVAudioUnitVarispeed.new();speed.rate=rate;
          this.attach(nodes,speed);
        }
      }
      const eq=this.addPreamp(nodes);
      this.engine.connectToFormat(eq,output.node,format);
      for(let index=nodes.length-2;index>=0;index--){
        this.engine.connectToFormat(nodes[index]!,nodes[index+1]!,format);
      }
      const setGain=(gain:number)=>this.applyGain(eq,output.node,gain);
      setGain(options.gain);output.node.pan=options.pan;
      this.voiceDisposers.add(dispose);
      const voice:AudioMixerHostVoice={
        nodeCount:nodes.length,
        stereoPan:true,
        start:onEnded=>{
          if(disposed||started)throw new Error('iOS audio voice cannot be started.');
          started=true;
          // Poll the native source timeline on the JS thread. Never call into JS from the audio thread.
          play();
          if(options.loop)this.loops.set(player,play);
          else{this.finiteVoices.set(player,{duration,end:onEnded});this.updateTimer();}
        },
        stop:()=>{if(started){this.loops.delete(player);player.stop();started=false;}},
        setGain:gain=>{if(!disposed)setGain(gain);},
        setPan:pan=>{if(!disposed)output.node.pan=pan;},
        dispose,
      };
      return {voice,player};
    }catch(error){dispose();throw error;}
  }

  setMasterVolume(value:number):void{this.assertOpen();this.master.setGain(value);}
  setBusVolume(bus:AudioMixerBus,value:number):void{this.assertOpen();this.busLevels.get(bus)!.setGain(value);}
  async suspend():Promise<void>{
    this.assertOpen();this.reactivate=false;this.pause(this.interruption?'interrupted':'suspended');
    this.deactivate();
  }
  async resume():Promise<void>{
    this.assertOpen();
    if(this.state==='running')return;
    const error=new interop.Reference<NSError>();
    // A began notification need not be followed by ended. Foreground or an
    // explicit Play can retry, with AVAudioSession deciding if it is safe.
    if(this.offlineRate===undefined){
      if(!this.session.setActiveError(true,error)){
        this.reactivate=this.interruption;
        throw new Error(`Unable to activate the iOS audio session${error.value?': '+error.value.localizedDescription+' ('+error.value.code+')':'.'}`);
      }
      this.active=true;
      this.interruption=false;
    }
    if(!this.engine.startAndReturnError(error)){
      this.deactivate();
      this.mode='suspended';
      throw new Error(`Unable to start AVAudioEngine${error.value?': '+error.value.localizedDescription+' ('+error.value.code+')':'.'}`);
    }
    try{
      for(const [player,play] of this.loops)if(!player.playing)play();
    }catch(error){
      this.pause('suspended');this.deactivate();throw error;
    }
    this.mode='running';this.reactivate=false;this.updateTimer();
  }

  close():void{
    if(this.mode==='closed')return;
    this.mode='closed';this.updateTimer();
    const errors:unknown[]=[];
    const release=(action:()=>void)=>{try{action();}catch(error){errors.push(error);}};
    for(const observer of this.observers)release(()=>NSNotificationCenter.defaultCenter.removeObserver(observer));
    this.observers.length=0;
    release(()=>this.stopReference());
    release(()=>this.engine.stop());
    for(const dispose of this.voiceDisposers)release(dispose);
    this.preparedBuffers.clear();
    release(()=>this.detach(this.outputNodes));this.voiceOutputs.length=0;this.busLevels.clear();release(()=>this.deactivate());
    if(errors.length)throw new AggregateError(errors,'iOS audio resources failed to close.');
  }

  snapshot(){
    return {state:this.state,stereoPan:this.stereoPan,outputChannels:this.session.outputNumberOfChannels,
      outputNodes:this.nodeCount,buffers:this.preparedBuffers.size,voices:this.voiceDisposers.size,
      observers:this.observers.length,polling:this.timer!==undefined};
  }

  playbackSnapshot(){
    return {state:this.state,outputVolume:this.session.outputVolume,referencePlaying:this.referencePlayer?.playing??false,loops:[...this.loops.keys()].map(player=>{
      return playerClock(player);
    })};
  }

  private pause(state:'suspended'|'interrupted'):void{
    if(this.mode==='closed')return;
    this.mode=state;this.stopReference();this.engine.pause();this.updateTimer();
  }
  private stopReference():void{const player=this.referencePlayer;this.referencePlayer=null;player?.stop();}
  private deactivate():void{
    if(!this.active)return;
    this.active=false;
    this.session.setActiveWithOptionsError(false,AVAudioSessionSetActiveOptions.NotifyOthersOnDeactivation);
  }
  private assertOpen():void{if(this.mode==='closed')throw new Error('The iOS audio engine is closed.');}
  private editGraph<T>(update:()=>T):T{
    if(!this.engine.running)return update();
    this.editingGraph=true;
    try{
      // Commit the complete route before the render engine starts pulling it.
      this.engine.pause();
      try{return update();}
      finally{
        const error=new interop.Reference<NSError>();
        this.engine.prepare();
        if(!this.engine.startAndReturnError(error)){
          throw new Error('Unable to restart the iOS audio graph: '+(error.value?.localizedDescription??'unknown error'));
        }
      }
    }catch(error){
      if(!this.engine.running){this.mode='suspended';this.deactivate();}
      throw error;
    }finally{this.editingGraph=false;this.updateTimer();}
  }
  private observe(name:string,object:NSObject|null,callback:(notification:NSNotification)=>void):void{
    this.observers.push(NSNotificationCenter.defaultCenter.addObserverForNameObjectQueueUsingBlock(name,object,NSOperationQueue.mainQueue,callback));
  }
  private attach(nodes:AVAudioNode[],node:AVAudioNode):void{this.engine.attachNode(node);nodes.push(node);}
  private detach(nodes:AVAudioNode[]):void{
    const errors:unknown[]=[];
    for(const node of nodes.splice(0).reverse())try{this.engine.detachNode(node);}catch(error){errors.push(error);}
    if(errors.length)throw new AggregateError(errors,'AVAudioEngine nodes failed to detach.');
  }
  private addPreamp(nodes:AVAudioNode[]):AVAudioUnitEQ{
    const eq=AVAudioUnitEQ.alloc().initWithNumberOfBands(1);
    eq.bands.objectAtIndex(0).bypass=true;
    this.attach(nodes,eq);return eq;
  }
  private addLevel():Level{
    const eq=this.addPreamp(this.outputNodes),output=AVAudioMixerNode.new(),input=AVAudioMixerNode.new();
    this.attach(this.outputNodes,output);this.attach(this.outputNodes,input);
    this.engine.connectToFormat(input,eq,this.stereoFormat);this.engine.connectToFormat(eq,output,this.stereoFormat);
    return {input,output,setGain:value=>this.applyGain(eq,output,value)};
  }
  private applyGain(eq:AVAudioUnitEQ,node:AVAudioMixerNode,value:number):void{
    // Mixer volume is 0..1. Positive gain uses the native EQ's global preamp.
    eq.globalGain=value>1?20*Math.log10(value):0;node.outputVolume=Math.min(1,value);
  }
  private takeVoiceOutput(bus:AudioMixerBus):VoiceOutput{
    // Keep mixers attached while AVAudioEngine is running. Only detach the
    // upstream player/effects when a voice retires.
    let slot=this.voiceOutputs.find(slot=>!slot.inUse&&slot.bus===bus)??this.voiceOutputs.find(slot=>!slot.inUse);
    if(!slot){
      if(this.voiceOutputs.length===this.maxVoices)throw new Error('iOS audio voice capacity is exhausted.');
      slot={node:AVAudioMixerNode.new(),bus:null,inUse:false};
      this.attach(this.outputNodes,slot.node);this.voiceOutputs.push(slot);
    }
    if(slot.bus!==bus){
      if(slot.bus!==null)this.engine.disconnectNodeOutput(slot.node);
      slot.bus=null;
      this.engine.connectToFormat(slot.node,this.busLevels.get(bus)!.input,this.stereoFormat);
      slot.bus=bus;
    }
    slot.inUse=true;return slot;
  }
  private updateTimer():void{
    if(this.state!=='running'||!this.finiteVoices.size){
      if(this.timer!==undefined)clearInterval(this.timer);
      this.timer=undefined;
    }else if(this.timer===undefined)this.timer=setInterval(()=>this.collectFinished(),25);
  }
  private collectFinished():void{
    if(this.state==='running')for(const [node,voice] of this.finiteVoices){
      const render=node.lastRenderTime,clock=render?node.playerTimeForNodeTime(render):null;
      if(clock?.sampleTimeValid&&clock.sampleTime/clock.sampleRate>=voice.duration){
        this.finiteVoices.delete(node);voice.end();
      }
    }
    this.updateTimer();
  }
}

function signalPeak(samples:Float32Array):number{
  let peak=0;
  for(const sample of samples)peak=Math.max(peak,Math.abs(sample));
  if(!Number.isFinite(peak))throw new Error('Native audio returned non-finite PCM.');
  return peak;
}
