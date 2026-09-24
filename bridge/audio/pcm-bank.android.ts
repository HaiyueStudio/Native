import { Utils } from '@nativescript/core';
export interface NativePcmSound { id: string; path: string; seconds: number }
export interface NativePcmPlay { channel: string; loop: boolean; gain: number; pan: number; priority: number }
/** Decode short PCM effects once; SoundPool owns playback on native audio threads. */
export class NativePcmAudioBank {
  private readonly pool: android.media.SoundPool;
  private readonly sounds = new Map<string, { nativeId: number; seconds: number }>();
  private readonly loaded = new Set<number>();
  private readonly streams = new Map<string, { id: number; until: number; gain: number; pan: number }>();
  private readonly longSounds = new Map<string, NativePcmSound>();
  private readonly players = new Map<string, { player: android.media.MediaPlayer; gain: number; pan: number; loop: boolean }>();
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
    // SoundPool truncates large decoded samples. Stream long music with MediaPlayer instead.
    for (const sound of sounds) if (sound.seconds > 8) this.longSounds.set(sound.id, sound);
    const shortSounds = sounds.filter(sound => !this.longSounds.has(sound.id));
    this.ready = new Promise(resolve => {
      const timer = setTimeout(() => { this.error='SoundPool decode timed out'; resolve(); }, 8000);
      this.pool.setOnLoadCompleteListener(new android.media.SoundPool.OnLoadCompleteListener({onLoadComplete: (_pool, id, status) => {
        if(this.disposed)return;
        if(status!==0){this.error=`SoundPool decode failed: ${id}/${status}`;clearTimeout(timer);resolve();return;}
        this.loaded.add(id); if(this.loaded.size===shortSounds.length){clearTimeout(timer);resolve();}
      }}));
      for(const sound of shortSounds){
        const id=this.pool.load(sound.path,1);
        if(!id){this.error=`Unable to load ${sound.id}`;clearTimeout(timer);resolve();break;}
        this.sounds.set(sound.id,{nativeId:id,seconds:sound.seconds}); this.pcmBytes+=Math.round(sound.seconds*44100)*2;
      }
      if(!shortSounds.length){clearTimeout(timer);resolve();}
    });
  }
  async load(): Promise<void> { await this.ready; }
  unlock(): void { if(!this.disposed&&!this.error)this.running=true; }
  play(id: string, options: NativePcmPlay): boolean {
    const sound=this.sounds.get(id), longSound=this.longSounds.get(id);
    if(!this.running||this.disposed||this.error||(!longSound&&(!sound||!this.loaded.has(sound.nativeId))))return false;
    const manager=Utils.android.getApplicationContext().getSystemService(android.content.Context.AUDIO_SERVICE) as android.media.AudioManager;
    if(manager.getRingerMode()!==android.media.AudioManager.RINGER_MODE_NORMAL)return true;
    this.stop(options.channel);
    const gain=Math.max(0,Math.min(1,options.gain*this.volume)),pan=Math.max(-1,Math.min(1,options.pan));
    if(longSound) {
      if(this.players.size>=8)return false;
      const player=new android.media.MediaPlayer();
      try {
        player.setAudioAttributes(new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_GAME).setContentType(android.media.AudioAttributes.CONTENT_TYPE_MUSIC).build());
        player.setDataSource(longSound.path);player.setLooping(options.loop);
        player.setVolume(gain*(pan>0?1-pan:1),gain*(pan<0?1+pan:1));
        player.setOnCompletionListener(new android.media.MediaPlayer.OnCompletionListener({onCompletion:()=>{if(this.players.get(options.channel)?.player===player)this.stop(options.channel);}}));
        player.setOnErrorListener(new android.media.MediaPlayer.OnErrorListener({onError:()=>{if(this.players.get(options.channel)?.player===player)this.stop(options.channel);return true;}}));
        player.prepare();this.players.set(options.channel,{player,gain:options.gain,pan,loop:options.loop});player.start();this.played++;return true;
      } catch(error) {player.release();this.players.delete(options.channel);this.error=String(error);return false;}
    }
    const stream=this.pool.play(sound!.nativeId,gain*(pan>0?1-pan:1),gain*(pan<0?1+pan:1),options.priority,options.loop?-1:0,1);
    if(!stream)return false;
    this.streams.set(options.channel,{id:stream,gain:options.gain,pan,until:options.loop?Infinity:performance.now()+sound!.seconds*1000});this.played++;return true;
  }
  setChannelGain(channel:string,gain:number):void {
    const voice=this.streams.get(channel)??this.players.get(channel);if(!voice)return;
    const next=Math.max(0,Math.min(1,gain));if(voice.gain===next)return;
    voice.gain=next;this.applyVolume(channel);
  }
  private applyVolume(channel:string):void {
    const stream=this.streams.get(channel), entry=this.players.get(channel), voice=stream??entry;if(!voice)return;
    const gain=Math.max(0,Math.min(1,voice.gain*this.volume));
    const left=gain*(voice.pan>0?1-voice.pan:1),right=gain*(voice.pan<0?1+voice.pan:1);
    if(stream)this.pool.setVolume(stream.id,left,right);else entry!.player.setVolume(left,right);
  }
  stop(channel?: string): void {for(const [key,entry] of this.players)if(channel===undefined||channel===key){entry.player.release();this.players.delete(key);}for(const [key,stream] of this.streams)if(channel===undefined||channel===key){this.pool.stop(stream.id);this.streams.delete(key);}}
  setVolume(volume:number):void {const next=Math.max(0,Math.min(1,volume))*.6;if(this.volume===next)return;this.volume=next;for(const key of [...this.streams.keys(),...this.players.keys()])this.applyVolume(key);}
  suspend():void {if(this.disposed)return;this.stop();this.pool.autoPause();this.running=false;}
  dispose():void {if(this.disposed)return;this.suspend();this.disposed=true;this.pool.release();this.sounds.clear();this.loaded.clear();}
  snapshot(){return {kind:'android-sound-pool',error:this.error,running:this.running,buffers:this.loaded.size+this.longSounds.size,pcmBytes:this.pcmBytes,voices:[...this.streams.values()].filter(v=>v.until>performance.now()).length+this.players.size,nodeCount:8+this.players.size,loopChannels:[...[...this.streams].filter(([,v])=>v.until===Infinity).map(([k])=>k),...[...this.players].filter(([,v])=>v.loop).map(([k])=>k)],played:this.played,volume:this.volume,disposed:this.disposed};}
}
