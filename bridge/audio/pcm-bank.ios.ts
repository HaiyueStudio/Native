export interface NativePcmSound { id:string; path:string; seconds:number }
export interface NativePcmPlay {channel:string;loop:boolean;gain:number;pan:number;priority:number}
interface Voice {node:AVAudioPlayerNode;channel:string|null;until:number;priority:number;sequence:number}
/** Cached PCM buffers + a fixed AVAudioEngine node pool. No JavaScript render/completion callbacks. */
export class NativePcmAudioBank {
  private readonly engine=AVAudioEngine.new();
  private readonly buffers=new Map<string,{buffer:AVAudioPCMBuffer;seconds:number}>();
  private readonly voices:Voice[]=[];
  private readonly observers:NSObjectProtocol[]=[];
  private error:string|null=null;
  private disposed=false;
  private running=false;
  private sequence=0;
  private played=0;
  private bytes=0;
  private volume=0.65;
  constructor(sounds:readonly NativePcmSound[],private readonly onInterruption:()=>void=()=>{}) {
    try {
      if(!AVAudioSession.sharedInstance().setCategoryError(AVAudioSessionCategoryAmbient))throw new Error('Unable to configure ambient audio session');
      for(const sound of sounds){
        const file=AVAudioFile.alloc().initForReadingError(NSURL.fileURLWithPath(sound.path));
        if(!file||file.length<1||file.length>44100*4||file.processingFormat.channelCount!==1)throw new Error(`Invalid PCM effect ${sound.id}`);
        const buffer=AVAudioPCMBuffer.alloc().initWithPCMFormatFrameCapacity(file.processingFormat,Number(file.length));
        if(!file.readIntoBufferError(buffer))throw new Error(`Unable to decode ${sound.id}`);
        this.buffers.set(sound.id,{buffer,seconds:buffer.frameLength/buffer.format.sampleRate});this.bytes+=buffer.frameLength*4;
      }
      const format=this.buffers.values().next().value?.buffer.format;
      if(!format)throw new Error('Empty PCM sound bank');
      for(let i=0;i<12;i++){const node=AVAudioPlayerNode.new();this.engine.attachNode(node);this.engine.connectToFormat(node,this.engine.mainMixerNode,format);this.voices.push({node,channel:null,until:0,priority:0,sequence:0});}
      this.engine.mainMixerNode.outputVolume=this.volume*0.6;this.engine.prepare();
      const center=NSNotificationCenter.defaultCenter;
      this.observers.push(center.addObserverForNameObjectQueueUsingBlock(AVAudioSessionInterruptionNotification,null,NSOperationQueue.mainQueue,n=>{
        if(Number(n.userInfo?.objectForKey(AVAudioSessionInterruptionTypeKey))===AVAudioSessionInterruptionType.Began)this.interrupt();
      }));
      this.observers.push(center.addObserverForNameObjectQueueUsingBlock(AVAudioSessionRouteChangeNotification,null,NSOperationQueue.mainQueue,n=>{
        if(Number(n.userInfo?.objectForKey(AVAudioSessionRouteChangeReasonKey))===AVAudioSessionRouteChangeReason.OldDeviceUnavailable)this.interrupt();
      }));
      this.observers.push(center.addObserverForNameObjectQueueUsingBlock(AVAudioEngineConfigurationChangeNotification,this.engine,NSOperationQueue.mainQueue,()=>{
        if(this.running&&!this.engine.running)this.interrupt();
      }));
    }catch(error){this.error=String(error);}
  }
  private now():number{return NSProcessInfo.processInfo.systemUptime;}
  private interrupt():void {if(this.disposed)return;this.suspend();this.onInterruption();}
  unlock():void {
    if(this.disposed||this.error||this.running)return;
    try{if(!AVAudioSession.sharedInstance().setActiveError(true)||!this.engine.startAndReturnError())throw new Error('Unable to start audio engine');this.running=true;}
    catch(error){this.error=String(error);}
  }
  play(id:string,options:NativePcmPlay):boolean {
    const sound=this.buffers.get(id);if(!this.running||this.disposed||this.error||!sound)return false;
    const now=this.now();let voice=this.voices.find(v=>v.channel===options.channel)||this.voices.find(v=>v.until<=now);
    if(!voice){voice=[...this.voices].sort((a,b)=>a.priority-b.priority||a.sequence-b.sequence)[0];if(!voice||voice.priority>options.priority)return false;}
    try {
      voice.node.stop();voice.channel=options.channel;voice.until=options.loop?Infinity:now+sound.seconds;voice.priority=options.priority;voice.sequence=this.sequence++;
      voice.node.volume=options.gain;voice.node.pan=options.pan;
      // NativeScript typings omit nullable annotations; null prevents JS callbacks on the audio thread.
      voice.node.scheduleBufferAtTimeOptionsCompletionHandler(sound.buffer,null as unknown as AVAudioTime,
        options.loop?AVAudioPlayerNodeBufferOptions.Loops:0 as AVAudioPlayerNodeBufferOptions,null as unknown as ()=>void);
      voice.node.play();this.played++;return true;
    }catch(error){this.error=String(error);this.suspend();return false;}
  }
  stop(channel?:string):void {
    for(const voice of this.voices)if(channel===undefined||voice.channel===channel){voice.node.stop();voice.channel=null;voice.until=0;}
  }
  setVolume(volume:number):void {this.volume=Math.max(0,Math.min(1,volume));this.engine.mainMixerNode.outputVolume=this.volume*0.6;}
  suspend():void {if(this.disposed)return;this.stop();this.engine.pause();this.running=false;}
  dispose():void {
    if(this.disposed)return;this.suspend();this.disposed=true;
    for(const observer of this.observers)NSNotificationCenter.defaultCenter.removeObserver(observer);this.observers.length=0;
    this.engine.stop();for(const voice of this.voices)this.engine.detachNode(voice.node);this.voices.length=0;this.buffers.clear();this.bytes=0;
  }
  snapshot(){return {kind:'av-audio-engine',error:this.error,running:this.running,buffers:this.buffers.size,pcmBytes:this.bytes,
    voices:this.voices.filter(v=>v.until>this.now()).length,nodeCount:this.voices.length,played:this.played,volume:this.volume,disposed:this.disposed};}
}
