import {createIosHyaAudioHost,type IosHyaAudioController} from './ios-audio-host';
import {encodeBase64} from './bytes-base64';
import type {HyaAudioHost,HyaAudioResource} from '@haiyue/extensions/hya-audio';

const sampleRate=48000,frames=512;
type Probe={id:string;start:number;offset:number;stop?:number;duration?:number;rate?:number;gainChange?:number;rateChange?:number;loop?:readonly[number,number]};
const probes:readonly Probe[]=[
  {id:'scheduled-start-and-source-offset',start:67,offset:19,stop:233},
  {id:'start-duration-argument',start:61,offset:23,duration:73},
  {id:'scheduled-stop',start:31,offset:0,stop:173},
  {id:'scheduled-gain',start:32,offset:0,stop:224,gainChange:128},
  {id:'constant-playback-rate',start:32,offset:0,stop:224,rate:2},
  {id:'scheduled-playback-rate',start:32,offset:0,stop:224,rateChange:128},
  {id:'loop-subrange',start:37,offset:11,stop:241,loop:[19,47]},
];
function wav():Uint8Array {
  const bytes=new Uint8Array(44+1024*2),view=new DataView(bytes.buffer),text=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)bytes[offset+i]=value.charCodeAt(i);};
  text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,2048,true);
  for(let i=0;i<1024;i++)view.setInt16(44+i*2,(i+32)*16,true);return bytes;
}
/** Actual custom AVAudioEngine offline output. Never label JS boundary mocks as these samples. */
export async function probeIosNativePcm(record:(event:string,detail:unknown)=>void,signal:AbortSignal) {
  if(signal.aborted)throw new Error('Native PCM probe cancelled.');
  const bytes=wav(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
  const resource:HyaAudioResource={id:'probe',codec:'wav',mediaType:'audio/wav',sampleRate,channels:1,frameLength:1024,integrity:{algorithm:'sha256',digest:hash},source:{kind:'hosted',key:'probe'}};
  const cases:{id:string;passed:boolean;maximumSampleError?:number;firstMismatch?:number;clock?:number;completed?:number;error?:string}[]=[];
  for(const probe of probes){
    let controller:IosHyaAudioController|undefined,buffer:Awaited<ReturnType<HyaAudioHost['decode']>>|undefined,voice:ReturnType<HyaAudioHost['schedule']>|undefined;
    const result:typeof cases[number]={id:probe.id,passed:false};
    try{
      if(signal.aborted)throw new Error('Native PCM probe cancelled.');
      controller=createIosHyaAudioHost({sampleRate,offline:true});const host=controller.host;
      buffer=await host.decode(resource,signal,bytes.slice().buffer);
      if(signal.aborted)throw new Error('Native PCM probe cancelled.');
      await host.unlock();
      let completed=0;voice=host.schedule({token:'probe:'+probe.id,value:buffer.value,startFrame:probe.start,offsetFrame:probe.offset,gain:probe.gainChange===undefined?1:.25,rate:probe.rate??1,bus:'probe',...(probe.duration===undefined?{}:{durationFrames:probe.duration}),...(probe.loop?{loop:{startFrame:probe.loop[0],endFrame:probe.loop[1]}}:{}),onEnded(){completed++;}});
      if(probe.stop!==undefined)voice.stop(probe.stop);
      if(probe.gainChange!==undefined)voice.setGain(.75,probe.gainChange);
      if(probe.rateChange!==undefined)voice.setRate(2,probe.rateChange);
      const actual=controller.renderOfflineFrames(frames),expected=new Float32Array(frames*2),end=probe.stop??(probe.duration===undefined?frames:probe.start+probe.duration);
      for(let frame=probe.start;frame<end;frame++){
        let position=probe.offset+(frame-probe.start)*(probe.rate??1);
        if(probe.rateChange!==undefined&&frame>=probe.rateChange)position+=frame-probe.rateChange;
        if(probe.loop&&position>=probe.loop[1])position=probe.loop[0]+(position-probe.loop[0])%(probe.loop[1]-probe.loop[0]);
        const volume=probe.gainChange!==undefined&&frame>=probe.gainChange ? .75 : probe.gainChange===undefined ? 1 : .25;
        expected[frame*2]=expected[frame*2+1]=(position+32)/2048*volume;
      }
      let maximumSampleError=0,firstMismatch=-1;
      for(let index=0;index<actual.length;index++){const error=Math.abs(actual[index]!-expected[index]!);if(!Number.isFinite(error))throw new Error('Native PCM contains nonfinite samples.');maximumSampleError=Math.max(maximumSampleError,error);if(error>1e-6&&firstMismatch<0)firstMismatch=index;}
      const clock=host.nowFrame();result.maximumSampleError=maximumSampleError;result.firstMismatch=firstMismatch;result.clock=clock;result.completed=completed;
      result.passed=firstMismatch<0&&clock===frames&&completed===1;
      record('native-pcm-samples',{id:probe.id,frames,channels:2,sampleRate,sourceSha256:hash,parameters:probe,encoding:'base64-float32-little-endian',actual:encodeBase64(new Uint8Array(actual.buffer)),expected:encodeBase64(new Uint8Array(expected.buffer))});
    }catch(error){result.error=String(error);}
    finally{
      const errors:string[]=[];for(const release of [()=>voice?.release(),()=>buffer?.release(),()=>controller?.dispose()])try{release();}catch(error){errors.push(String(error));}
      if(errors.length){result.passed=false;result.error=[result.error,...errors].filter(Boolean).join('; ');}
    }
    cases.push(result);record('native-pcm-case',result);
    if(signal.aborted)break;
  }
  const report={status:cases.length===probes.length&&cases.every(value=>value.passed)?'passed-native-offline-pcm':'failed-native-offline-pcm',cases,tolerance:1e-6,frames,sampleRate,scope:'Seven actual custom AVAudioEngine offline cases including real WAV decode and encoded SHA verification. Live drift, interruptions, route changes and full device qualification remain separate.',physicalNativeQualified:false,fullG11Complete:false};
  record('native-pcm-result',report);return report;
}
