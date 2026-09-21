import {knownFolders,path} from '@nativescript/core';
import {NativePcmAudioBank} from '../../../bridge/audio/pcm-bank';
import {SOUND_NAMES,type SoundCue} from '../../../../Games/games/boxbound/sound-events';
export class MobileAudio {
  private readonly bank=new NativePcmAudioBank(SOUND_NAMES.map(id=>({id,seconds:1.5,path:path.join(knownFolders.currentApp().path,'game/assets/audio',`${id}.wav`)})));
  private queue:(SoundCue&{at:number})[]=[];muted=false;
  async load(){await (this.bank as NativePcmAudioBank & {load?:()=>Promise<void>}).load?.();this.bank.unlock();}
  schedule(cues:SoundCue[]){if(!this.muted){this.bank.unlock();this.queue.push(...cues.map(c=>({...c,at:performance.now()+c.delay})));}}
  tick(){const now=performance.now();const due=this.queue.filter(c=>c.at<=now);this.queue=this.queue.filter(c=>c.at>now);for(const c of due)this.bank.play(c.name,{channel:c.name,loop:false,gain:.6,pan:0,priority:1});}
  stop(){this.queue=[];this.bank.suspend();}
  dispose(){this.stop();this.bank.dispose();}
}
