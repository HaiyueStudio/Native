import { Utils } from '@nativescript/core';
export interface NativePcmSound { id: string; path: string; seconds: number }
export interface NativePcmPlay { channel: string; loop: boolean; gain: number; pan: number; priority: number }
/** Decode short PCM effects once; SoundPool owns playback on native audio threads. */
export class NativePcmAudioBank {
  private readonly pool: android.media.SoundPool;
  private readonly sounds = new Map<string, { nativeId: number; seconds: number }>();
  private readonly loaded = new Set<number>();
  private readonly streams = new Map<string, { id: number; until: number }>();
  private readonly ready: Promise<void>;
  private error: string | null = null;
  private running = false;
  private disposed = false;
  private played = 0;
  private volume = .39;
  private pcmBytes = 0;
  constructor(sounds: readonly NativePcmSound[], _onInterruption: () => void = () => {}) {
    const attributes = new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_GAME).setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
    this.pool = new android.media.SoundPool.Builder().setMaxStreams(8).setAudioAttributes(attributes).build();
    this.ready = new Promise(resolve => {
      const timer = setTimeout(() => { this.error='SoundPool decode timed out'; resolve(); }, 8000);
      this.pool.setOnLoadCompleteListener(new android.media.SoundPool.OnLoadCompleteListener({onLoadComplete: (_pool, id, status) => {
        if(this.disposed)return;
        if(status!==0){this.error=`SoundPool decode failed: ${id}/${status}`;clearTimeout(timer);resolve();return;}
        this.loaded.add(id); if(this.loaded.size===sounds.length){clearTimeout(timer);resolve();}
      }}));
      for(const sound of sounds){
        const id=this.pool.load(sound.path,1);
        if(!id){this.error=`Unable to load ${sound.id}`;clearTimeout(timer);resolve();break;}
        this.sounds.set(sound.id,{nativeId:id,seconds:sound.seconds}); this.pcmBytes+=Math.round(sound.seconds*44100)*2;
      }
      if(!sounds.length){clearTimeout(timer);resolve();}
    });
  }
  async load(): Promise<void> { await this.ready; }
  unlock(): void { if(!this.disposed&&!this.error)this.running=true; }
  play(id: string, options: NativePcmPlay): boolean {
    const sound=this.sounds.get(id);if(!this.running||this.disposed||this.error||!sound||!this.loaded.has(sound.nativeId))return false;
    const manager=Utils.android.getApplicationContext().getSystemService(android.content.Context.AUDIO_SERVICE) as android.media.AudioManager;
    if(manager.getRingerMode()!==android.media.AudioManager.RINGER_MODE_NORMAL)return true;
    const previous=this.streams.get(options.channel);if(previous)this.pool.stop(previous.id);
    const gain=Math.max(0,Math.min(1,options.gain*this.volume)),pan=Math.max(-1,Math.min(1,options.pan));
    const stream=this.pool.play(sound.nativeId,gain*(pan>0?1-pan:1),gain*(pan<0?1+pan:1),options.priority,options.loop?-1:0,1);
    if(!stream)return false;
    this.streams.set(options.channel,{id:stream,until:options.loop?Infinity:performance.now()+sound.seconds*1000});this.played++;return true;
  }
  stop(channel?: string): void {for(const [key,stream] of this.streams)if(channel===undefined||channel===key){this.pool.stop(stream.id);this.streams.delete(key);}}
  setVolume(volume:number):void {this.volume=Math.max(0,Math.min(1,volume))*.6;}
  suspend():void {if(this.disposed)return;this.stop();this.pool.autoPause();this.running=false;}
  dispose():void {if(this.disposed)return;this.suspend();this.disposed=true;this.pool.release();this.sounds.clear();this.loaded.clear();}
  snapshot(){return {kind:'android-sound-pool',error:this.error,running:this.running,buffers:this.loaded.size,pcmBytes:this.pcmBytes,voices:[...this.streams.values()].filter(v=>v.until>performance.now()).length,nodeCount:8,loopChannels:[...this.streams].filter(([,v])=>v.until===Infinity).map(([k])=>k),played:this.played,volume:this.volume,disposed:this.disposed};}
}
