import {File,knownFolders,path} from '@nativescript/core';
import type {HyaPlayerHost} from '@haiyue/extensions/hya-player';
import type {HyaAudioHost} from '@haiyue/extensions/hya-audio';

interface Asset {readonly file:string;readonly bytes:number;readonly sha256:string;readonly integrity:string;}
interface Manifest {readonly assets:Readonly<Record<string,Asset>>;readonly scene:{readonly file:string;readonly sha256:string};}
const hex=(buffer:ArrayBuffer)=>Array.from(new Uint8Array(buffer),value=>value.toString(16).padStart(2,'0')).join('');
/** Foundation read plus an owned byte copy; never turn NSData into a guessed JS array. */
function readBytes(file:string):Uint8Array {
  const data=NSData.dataWithContentsOfFile(file);
  if(!data)throw new Error('Native scene asset cannot be read: '+file);
  return new Uint8Array(interop.bufferFromData(data)).slice();
}
export async function loadSceneResources(record:(event:string,detail:unknown)=>void) {
  const root=path.join(knownFolders.currentApp().path,'assets'),manifest=JSON.parse(File.fromPath(path.join(root,'manifest.json')).readTextSync()) as Manifest;
  const verified=new Map<string,Uint8Array>();let acquired=0,released=0,closed=false;
  for(const [id,descriptor] of Object.entries(manifest.assets)){
    if(!/^[a-zA-Z0-9.-]+$/.test(descriptor.file))throw new Error('Asset path is outside the fixed scene manifest.');
    const bytes=readBytes(path.join(root,descriptor.file));
    if(bytes.byteLength!==descriptor.bytes||hex(await crypto.subtle.digest('SHA-256',bytes))!==descriptor.sha256)throw new Error('Scene asset integrity mismatch: '+id);
    verified.set(id,bytes);
  }
  if(!/^[a-zA-Z0-9.-]+$/.test(manifest.scene.file))throw new Error('Invalid scene path.');
  const sceneBytes=readBytes(path.join(root,manifest.scene.file));
  if(hex(await crypto.subtle.digest('SHA-256',sceneBytes))!==manifest.scene.sha256)throw new Error('Scene document integrity mismatch.');
  const source:unknown=JSON.parse(new TextDecoder().decode(sceneBytes));
  const bytesFor=(id:string)=>{
    if(closed)throw new Error('Native scene resource owner is closed.');
    const value=verified.get(id);if(!value)throw new Error('Undeclared Native scene resource: '+id);return value.slice();
  };
  const resources:NonNullable<HyaPlayerHost['resources']>={async acquire(request){
    if(request.signal.aborted)throw new Error('Native scene acquisition aborted.');
    const id=request.asset==='core-image'?'alternate':request.asset,descriptor=manifest.assets[id];
    if(!descriptor||request.integrity!==descriptor.integrity)throw new Error('Resource request differs from the fixed manifest: '+request.asset);
    const value=bytesFor(id);++acquired;let retired=false;
    return Object.freeze({value,generation:1,bytes:value.byteLength,release(){if(retired)return;retired=true;++released;}});
  }};
  const resolve:NonNullable<HyaAudioHost['resolve']>=async(resource,signal)=>{
    if(signal.aborted)throw new Error('Native audio acquisition aborted.');
    if(resource.source.kind!=='hosted'||resource.source.key!=='tone'||resource.integrity.digest!==manifest.assets.tone?.sha256)throw new Error('Audio request differs from the fixed manifest.');
    return bytesFor('tone').buffer;
  };
  record('assets-verified',{scene:manifest.scene.sha256,assets:Object.keys(manifest.assets),bytes:[...verified.values()].reduce((sum,value)=>sum+value.byteLength,0)});
  return {source,resources,resolve,snapshot:()=>({acquired,released,live:acquired-released,closed}),dispose(){closed=true;verified.clear();}};
}
