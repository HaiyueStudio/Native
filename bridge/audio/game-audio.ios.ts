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
  private readonly preparedBuffers=new Map<AudioBuffer,{pcm:AVAudioPCMBuffer;refs:number}>();
  private timer:ReturnType<typeof setInterval>|undefined;
  private mode:AudioMixerHost['state']='suspended';
  private interruption=false;
  private reactivate=false;
  private active=false;

  constructor(private readonly report:(event:string,detail:unknown)=>void=()=>{},private readonly maxVoices=128){
    try{
      if(!Number.isSafeInteger(maxVoices)||maxVoices<1||maxVoices>1024)throw new RangeError('Invalid iOS audio voice capacity.');
      if(!this.session.setCategoryError(AVAudioSessionCategoryAmbient))throw new Error('Unable to set the iOS ambient audio category.');
      this.stereoFormat=AVAudioFormat.alloc().initStandardFormatWithSampleRateChannels(this.sampleRate,2);
      this.master=this.addLevel();
      this.engine.connectToFormat(this.master.output,this.engine.mainMixerNode,this.stereoFormat);
      for(const bus of buses){
        const level=this.addLevel();
        this.engine.connectToFormat(level.output,this.master.input,this.stereoFormat);
        this.busLevels.set(bus,level);
      }
      this.observe(AVAudioSessionInterruptionNotification,null,notification=>{
        const type=Number(notification.userInfo?.objectForKey(AVAudioSessionInterruptionTypeKey));
        if(type===AVAudioSessionInterruptionType.Began){
          this.reactivate=this.state==='running';
          this.interruption=true;this.pause('interrupted');
        }else if(type===AVAudioSessionInterruptionType.Ended){
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
  get sampleRate():number{return this.session.sampleRate||48000;}
  get stereoPan():boolean{return this.state==='running'&&this.session.outputNumberOfChannels>=2;}
  get nodeCount():number{return this.outputNodes.length;}

  createBuffer(channels:number,frames:number,rate:number):AudioBuffer{return new PcmBuffer(channels,frames,rate);}

  async decodeAudioData(bytes:ArrayBuffer):Promise<AudioBuffer>{
    this.assertOpen();
    if(bytes.byteLength>64*1024*1024)throw new RangeError('iOS encoded audio exceeds 64 MiB.');
    const name=`haiyue-game-audio-${Date.now()}-${++decodeSequence}`;
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
      const result=new PcmBuffer(processingFormat.channelCount,pcm.frameLength,processingFormat.sampleRate);
      for(let channel=0;channel<result.numberOfChannels;channel++){
        const samples=result.getChannelData(channel);
        const data=NSData.dataWithBytesNoCopyLengthFreeWhenDone(pcmChannel(pcm,channel),samples.byteLength,false);
        samples.set(new Float32Array(interop.bufferFromData(data)));
      }
      return result;
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

  releaseBuffer(buffer:AudioBuffer):void{
    const entry=this.preparedBuffers.get(buffer);
    if(entry&&--entry.refs===0)this.preparedBuffers.delete(buffer);
  }

  private toNativePcm(buffer:AudioBuffer):AVAudioPCMBuffer{
    validatePcm(buffer.numberOfChannels,buffer.length,buffer.sampleRate);
    const format=AVAudioFormat.alloc().initStandardFormatWithSampleRateChannels(buffer.sampleRate,buffer.numberOfChannels);
    const pcm=AVAudioPCMBuffer.alloc().initWithPCMFormatFrameCapacity(format,buffer.length);
    if(!pcm)throw new Error('Unable to allocate iOS voice PCM.');
    pcm.frameLength=buffer.length;
    for(let channel=0;channel<buffer.numberOfChannels;channel++){
      const input=buffer.getChannelData(channel);
      if(input.length!==buffer.length)throw new Error('Invalid iOS voice PCM channel.');
      const source=interop.handleof(input.buffer).add(input.byteOffset);
      const data=NSData.dataWithBytesNoCopyLengthFreeWhenDone(source,input.byteLength,false);
      data.getBytesLength(pcmChannel(pcm,channel),input.byteLength);
    }
    return pcm;
  }

  openVoice(buffer:AudioBuffer,options:Parameters<AudioMixerHost['openVoice']>[1]):AudioMixerHostVoice{
    this.assertOpen();
    if(this.state!=='running')throw new Error('The iOS audio engine is suspended.');
    const pcm=this.preparedBuffers.get(buffer)?.pcm??this.toNativePcm(buffer),format=pcm.format;
    const player=AVAudioPlayerNode.new(),nodes:AVAudioNode[]=[];
    const output=this.takeVoiceOutput(options.bus);
    let disposed=false,started=false;
    const dispose=()=>{
      if(disposed)return;
      disposed=true;
      this.finiteVoices.delete(player);this.updateTimer();
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
          player.scheduleBufferAtTimeOptionsCompletionHandler(pcm,null as unknown as AVAudioTime,
            options.loop?AVAudioPlayerNodeBufferOptions.Loops:0 as AVAudioPlayerNodeBufferOptions,null as unknown as ()=>void);
          player.play();
          if(!options.loop){this.finiteVoices.set(player,{duration:buffer.duration,end:onEnded});this.updateTimer();}
        },
        stop:()=>{if(started){player.stop();started=false;}},
        setGain:gain=>{if(!disposed)setGain(gain);},
        setPan:pan=>{if(!disposed)output.node.pan=pan;},
        dispose,
      };
    }catch(error){dispose();throw error;}
  }

  setMasterVolume(value:number):void{this.assertOpen();this.master.setGain(value);}
  setBusVolume(bus:AudioMixerBus,value:number):void{this.assertOpen();this.busLevels.get(bus)!.setGain(value);}
  async suspend():Promise<void>{this.assertOpen();this.reactivate=false;this.pause(this.interruption?'interrupted':'suspended');}
  async resume():Promise<void>{
    this.assertOpen();
    if(this.state==='running')return;
    if(this.interruption){this.reactivate=true;throw new Error('The iOS audio session is interrupted.');}
    if(!this.session.setActiveError(true))throw new Error('Unable to activate the iOS audio session.');
    this.active=true;
    if(!this.engine.startAndReturnError()){
      this.deactivate();
      throw new Error('Unable to start AVAudioEngine.');
    }
    this.mode='running';this.updateTimer();
  }

  close():void{
    if(this.mode==='closed')return;
    this.mode='closed';this.updateTimer();
    const errors:unknown[]=[];
    const release=(action:()=>void)=>{try{action();}catch(error){errors.push(error);}};
    for(const observer of this.observers)release(()=>NSNotificationCenter.defaultCenter.removeObserver(observer));
    this.observers.length=0;
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

  private pause(state:'suspended'|'interrupted'):void{
    if(this.mode==='closed')return;
    this.mode=state;this.engine.pause();this.updateTimer();
  }
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
