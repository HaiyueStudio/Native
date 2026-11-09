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
  const data=NSData.dataWithBytesNoCopyLengthFreeWhenDone(pcmChannel(buffer,channel),buffer.frameLength*4,false);
  return new Float32Array(interop.bufferFromData(data));
}

function encodePcmCaf(buffer:AudioBuffer):ArrayBuffer{
  const {numberOfChannels:channels,length,sampleRate}=buffer;
  validatePcm(channels,length,sampleRate);
  const samples=Array.from({length:channels},(_,channel)=>buffer.getChannelData(channel));
  if(samples.some(channel=>channel.length!==length))throw new Error('Invalid iOS voice PCM channel.');
  const size=length*channels*4,caf=new ArrayBuffer(68+size),view=new DataView(caf);
  view.setUint32(0,0x63616666);view.setUint16(4,1); // caff, version 1
  view.setUint32(8,0x64657363);view.setBigUint64(12,32n); // desc
  view.setFloat64(20,sampleRate);view.setUint32(28,0x6c70636d); // lpcm
  view.setUint32(32,3); // Float32, little-endian data
  view.setUint32(36,channels*4);view.setUint32(40,1);
  view.setUint32(44,channels);view.setUint32(48,32);
  view.setUint32(52,0x64617461);view.setBigUint64(56,BigInt(size+4)); // data, including edit count
  let offset=68;
  for(let frame=0;frame<length;frame++)for(const channel of samples){
    view.setFloat32(offset,channel[frame]!,true);offset+=4;
  }
  return caf;
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
        if(this.mode==='running'&&!this.engine.running)this.pause('suspended');
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
    const result=new PcmBuffer(pcm.format.channelCount,pcm.frameLength,pcm.format.sampleRate);
    for(let channel=0;channel<result.numberOfChannels;channel++)result.getChannelData(channel).set(readSamples(pcm,channel));
    return result;
  }

  private readNativeFile(bytes:ArrayBuffer,suffix=''):AVAudioPCMBuffer{
    const name=`haiyue-game-audio-${Date.now()}-${++decodeSequence}${suffix}`;
    const filePath=path.join(knownFolders.temp().path,name),url=NSURL.fileURLWithPath(filePath);
    const data=NSData.dataWithBytesLength(interop.handleof(bytes),bytes.byteLength);
    try{
      if(!data.writeToURLOptionsError(url,0 as NSDataWritingOptions))throw new Error('Unable to stage iOS audio bytes.');
      const file=AVAudioFile.alloc().initForReadingCommonFormatInterleavedError(url,AVAudioCommonFormat.PCMFormatFloat32,false);
      if(!file)throw new Error('AVAudioFile could not open the encoded audio.');
      const {processingFormat}=file,frames=Number(file.length);
      validatePcm(processingFormat.channelCount,frames,processingFormat.sampleRate);
      const pcm=AVAudioPCMBuffer.alloc().initWithPCMFormatFrameCapacity(processingFormat,frames);
      if(!pcm||!file.readIntoBufferError(pcm)||pcm.frameLength<1)throw new Error('Unable to decode iOS audio.');
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
    const inputPeak=Array.from({length:pcm.format.channelCount},(_,channel)=>signalPeak(readSamples(pcm,channel)));
    const offline=new IosGameAudioHost(this.report,1,pcm.format.sampleRate);
    try{
      offline.preparedBuffers.set(buffer,{pcm,refs:1});
      await offline.resume();
      const voice=offline.openVoice(buffer,{bus:'ui',loop:true,frequency:1,gain:1,pan:0});
      voice.start(()=>{});
      const rendered=AVAudioPCMBuffer.alloc().initWithPCMFormatFrameCapacity(offline.engine.manualRenderingFormat,1024);
      const outputPeak=[0,0],statuses:number[]=[];
      let frames=0;
      for(let attempt=0;attempt<8&&frames<4096;attempt++){
        const status=offline.engine.renderOfflineToBufferError(1024,rendered);
        statuses.push(status);
        if(status===AVAudioEngineManualRenderingStatus.Error)break;
        if(status!==AVAudioEngineManualRenderingStatus.Success)continue;
        frames+=rendered.frameLength;
        for(let channel=0;channel<2;channel++)outputPeak[channel]=Math.max(outputPeak[channel]!,signalPeak(readSamples(rendered,channel)));
      }
      return {sampleRate:pcm.format.sampleRate,inputPeak,outputPeak,renderedFrames:frames,statuses};
    }finally{offline.close();}
  }

  playReferenceTone(buffer:AudioBuffer):void{
    this.assertOpen();
    if(this.state!=='running')throw new Error('The iOS audio session must be active for the reference tone.');
    this.stopReference();
    const bytes=encodePcmCaf(buffer),data=NSData.dataWithBytesLength(interop.handleof(bytes),bytes.byteLength);
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
    // Let AVAudioFile populate its PCM buffer. No JavaScript write through
    // the nested NativeScript float** representation is needed.
    const pcm=this.readNativeFile(encodePcmCaf(buffer),'.caf');
    if(pcm.frameLength!==buffer.length||pcm.format.channelCount!==buffer.numberOfChannels||
      pcm.format.sampleRate!==buffer.sampleRate)throw new Error('Native PCM differs from the installed format.');
    return pcm;
  }

  openVoice(buffer:AudioBuffer,options:Parameters<AudioMixerHost['openVoice']>[1]):AudioMixerHostVoice{
    this.assertOpen();
    if(this.state!=='running')throw new Error('The iOS audio engine is suspended.');
    this.stopReference();
    const pcm=this.preparedBuffers.get(buffer)?.pcm??this.toNativePcm(buffer),format=pcm.format;
    const player=AVAudioPlayerNode.new(),nodes:AVAudioNode[]=[];
    const output=this.takeVoiceOutput(options.bus);
    let disposed=false,started=false;
    const play=()=>{
      player.scheduleBufferAtTimeOptionsCompletionHandler(pcm,null as unknown as AVAudioTime,
        options.loop?AVAudioPlayerNodeBufferOptions.Loops:0 as AVAudioPlayerNodeBufferOptions,null as unknown as ()=>void);
      player.play();
    };
    const dispose=()=>{
      if(disposed)return;
      disposed=true;
      this.finiteVoices.delete(player);this.updateTimer();
      this.loops.delete(player);
      this.voiceDisposers.delete(dispose);
      try{if(started)player.stop();}finally{try{this.detach(nodes);}finally{output.inUse=false;}}
    };
    try{
      this.attach(nodes,player);
      let source:AVAudioNode=player;
      if(options.frequency!==1){
        const split=options.frequency<.25||options.frequency>4;
        const rate=split?Math.sqrt(options.frequency):options.frequency;
        for(let i=0;i<(split?2:1);i++){
          const speed=AVAudioUnitVarispeed.new();speed.rate=rate;
          this.attach(nodes,speed);this.engine.connectToFormat(source,speed,format);source=speed;
        }
      }
      const eq=this.addPreamp(nodes);
      this.engine.connectToFormat(source,eq,format);
      this.engine.connectToFormat(eq,output.node,format);
      const setGain=(gain:number)=>this.applyGain(eq,output.node,gain);
      setGain(options.gain);output.node.pan=options.pan;
      this.voiceDisposers.add(dispose);
      return {
        nodeCount:nodes.length,
        stereoPan:true,
        start:onEnded=>{
          if(disposed||started)throw new Error('iOS audio voice cannot be started.');
          started=true;
          // Poll the native source timeline on the JS thread. Never call into JS from the audio thread.
          play();
          if(options.loop)this.loops.set(player,play);
          else{this.finiteVoices.set(player,{duration:buffer.duration,end:onEnded});this.updateTimer();}
        },
        stop:()=>{if(started){this.loops.delete(player);player.stop();started=false;}},
        setGain:gain=>{if(!disposed)setGain(gain);},
        setPan:pan=>{if(!disposed)output.node.pan=pan;},
        dispose,
      };
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
    this.mode='running';this.reactivate=false;this.updateTimer();
    for(const [player,play] of this.loops)if(!player.playing)play();
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
      const time=player.lastRenderTime,clock=time?player.playerTimeForNodeTime(time):null;
      return {playing:player.playing,sampleTime:clock?.sampleTimeValid?clock.sampleTime:null};
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
