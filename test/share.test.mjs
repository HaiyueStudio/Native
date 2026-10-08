import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTS } from './support/load-ts.mjs';

const png = () => new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64'));
const image = () => ({ bytes: png(), mimeType: 'image/png', filename: 'result.png' });
const types = loadTS('bridge/share/types.ts');
test('share validates complete data before platform work and owns image bytes', () => {
  for (const value of [null, {}, {title:'Only title'}, {text:' '}, {url:'javascript:alert(1)'}, {url:'https://'},
    {text:'\0'}, {image:null}, {image:{...image(),filename:'../result.png'}}, {image:{...image(),mimeType:'image/jpeg'}},
    {image:{...image(),bytes:new Uint8Array(10*1024*1024+1)}}]) {
    assert.throws(() => types.validateShare(value), error => error.code === 'invalid-data');
  }
  const input = {text:'Best score', url:'https://example.com/challenge?a=1', image:image()};
  const result = types.validateShare(input);
  input.image.bytes.fill(0);
  assert.equal(result.image.bytes[0],137);
});
function web(navigator = {}) {
  return loadTS('bridge/share/share-content.web.ts', {}, {navigator,File,Uint8Array});
}
test('Web reports unavailable API or unsupported image without dropping content', async () => {
  const f=web();assert.equal(f.canShareContent({text:'score'}),false);assert.equal((await f.shareContent({text:'score'})).status,'unsupported');
  const noFiles=web({share:()=>{throw Error('must not open');}});
  assert.equal((await noFiles.shareContent({image:image()})).status,'unsupported');
  assert.equal(web({share(){},canShare:()=>false}).canShareContent({text:'score'}),false);
  assert.equal(f.canShareContent({}),false);
});
test('Web invokes share synchronously in the click turn and preserves bytes, title, text and URL', async () => {
  let called=false,finish,captured;
  const f=web({canShare:()=>true,share:value=>{called=true;captured=value;return new Promise(r=>finish=r);}});
  const pending=f.shareContent({title:'Result',text:'Score: 10',url:'https://example.com',image:image()});
  assert.equal(called,true);
  assert.equal(captured.files[0].name,'result.png');assert.equal(captured.files[0].type,'image/png');
  assert.deepEqual(new Uint8Array(await captured.files[0].arrayBuffer()),png());
  assert.equal(captured.text,'Score: 10');assert.equal(captured.url,'https://example.com');
  await assert.rejects(f.shareContent({text:'again'}),e=>e.code==='busy');
  finish();assert.equal((await pending).status,'completed');
});
test('Web distinguishes cancellation and failures, releases busy and supports retry', async () => {
  let mode='cancel';const f=web({share:()=>mode==='ok'?Promise.resolve():Promise.reject(Object.assign(new Error(mode),{name:mode==='cancel'?'AbortError':'NotAllowedError'}))});
  assert.equal((await f.shareContent({text:'score'})).status,'cancelled');mode='denied';
  await assert.rejects(f.shareContent({text:'score'}),e=>e.code==='failed');mode='ok';
  assert.equal((await f.shareContent({text:'score'})).status,'completed');
});

function ios() {
  const queue=[],controllers=[],files=[],removed=[];
  const host={view:{window:{},bounds:{size:{width:100,height:200}}},presentViewControllerAnimatedCompletion:c=>controllers.push(c)};
  const api=loadTS('bridge/share/share-content.ios.ts',{'@nativescript/core':{
    Application:{ios:{rootController:host}},Utils:{executeOnMainThread:f=>queue.push(f)},
    Folder:{fromPath:path=>({path,remove:async()=>removed.push(path)})},knownFolders:{temp:()=>({path:'/cache'})},
    File:{fromPath:path=>({path,writeSync:bytes=>files.push({path,bytes})})},
  }},{
    NSURL:{URLWithString:value=>({url:value}),fileURLWithPath:path=>({path})},
    NSData:{dataWithBytesLength:buffer=>new Uint8Array(buffer)},interop:{handleof:buffer=>buffer},UIImage:{imageWithData:()=>({})},
    UIActivityViewController:{alloc:()=>({initWithActivityItemsApplicationActivities:items=>({items,popoverPresentationController:{},setValueForKey(value,key){this[key]=value;}})})},
    CGRectMake:(x,y,width,height)=>({x,y,width,height}),
  });
  return {...api,host,controllers,files,removed,flush:()=>{while(queue.length)queue.shift()();},complete:(ok,error)=>controllers.at(-1).completionWithItemsHandler(null,ok,null,error)};
}
test('iOS presents on main thread, anchors iPad, shares URL/image and deletes file on completion', async () => {
  const f=ios();const run=f.shareContent({title:'Score',text:'10 points',url:'https://example.com',image:image()});
  assert.equal(f.controllers.length,0);await assert.rejects(f.shareContent({text:'again'}),e=>e.code==='busy');f.flush();
  const controller=f.controllers[0];assert.equal(controller.subject,'Score');assert.equal(controller.items.length,3);
  assert.equal(controller.popoverPresentationController.sourceView,f.host.view);
  assert.equal(controller.popoverPresentationController.sourceRect.x,50);assert.match(f.files[0].path,/result.png$/);
  f.complete(true);assert.equal((await run).status,'completed');assert.equal(f.removed.length,1);
});
test('iOS cancellation, failure and no foreground view release the pending operation', async () => {
  const f=ios();let run=f.shareContent({text:'score'});f.flush();f.complete(false);assert.equal((await run).status,'cancelled');
  run=f.shareContent({text:'score'});f.flush();f.complete(false,{localizedDescription:'system failed'});await assert.rejects(run,e=>e.code==='failed');
  f.host.view.window=null;run=f.shareContent({text:'score'});f.flush();await assert.rejects(run,e=>e.code==='unavailable');
  f.host.view.window={};run=f.shareContent({text:'score'});f.flush();f.complete(true);assert.equal((await run).status,'completed');
});

function android() {
  const listeners=new Set(),exits=new Set(),opened=[],entries=new Map(),writes=[];
  let provider=true,fail=false;
  class JavaFile {
    constructor(parent,name){this.path=name?`${parent.path??parent}/${name}`:parent;}
    exists(){return entries.has(this.path);}mkdirs(){entries.set(this.path,{folder:true,time:Date.now()});return true;}
    listFiles(){return [...entries.keys()].filter(p=>p.startsWith(this.path+'/')&&!p.slice(this.path.length+1).includes('/')).map(p=>new JavaFile(p));}
    getName(){return this.path.split('/').at(-1);}lastModified(){return entries.get(this.path)?.time??0;}
    delete(){entries.delete(this.path);return true;}
  }
  class Intent {
    static ACTION_SEND='send';static EXTRA_TEXT='text';static EXTRA_SUBJECT='subject';static EXTRA_STREAM='stream';static FLAG_GRANT_READ_URI_PERMISSION=1;
    constructor(action){this.action=action;this.extras={};this.flags=0;}setType(value){this.type=value;}putExtra(key,value){this.extras[key]=value;}
    setClipData(value){this.clip=value;}addFlags(value){this.flags|=value;}
    static createChooser(intent,title){const chooser=new Intent('chooser');chooser.intent=intent;chooser.title=title;return chooser;}
  }
  const activity={isFinishing:()=>false,getPackageName:()=> 'test.game',getPackageManager:()=>({resolveContentProvider:()=>provider}),getCacheDir:()=>new JavaFile('/cache'),startActivityForResult:(intent,code)=>{if(fail)throw Error('Cannot launch');opened.push({intent,code});}};
  const app={foregroundActivity:activity,activityResultEvent:'result',on:(_,f)=>listeners.add(f),off:(_,f)=>listeners.delete(f)};
  const api=loadTS('bridge/share/share-content.android.ts',{'@nativescript/core':{Application:{android:app,exitEvent:'exit',on:(_,f)=>exits.add(f),off:(_,f)=>exits.delete(f)}}},{
    Array:class extends Array{static create(_kind,count){return new Int8Array(count);}},
    android:{content:{Intent,ClipData:{newRawUri:(name,uri)=>({name,uri})}}},
    java:{io:{File:JavaFile,FileOutputStream:class{constructor(file){this.file=file;}write(bytes){entries.set(this.file.path,{time:Date.now()});writes.push(bytes);}close(){}}}},
    androidx:{core:{content:{FileProvider:{getUriForFile:(_context,authority,file)=>({authority,path:file.path})}}}},
  });
  return {...api,app,opened,entries,writes,listeners,exits,setProvider:v=>provider=v,setFail:v=>fail=v,emit:code=>{for(const f of [...listeners])f({requestCode:code});}};
}
test('Android creates private file/URI with read grant, retains it after chooser and never claims publication', async () => {
  const f=android(),run=f.shareContent({title:'Result',text:'Score',url:'https://example.com',image:image()});
  const {intent:chooser,code}=f.opened[0],intent=chooser.intent;
  assert.equal(intent.type,'image/png');assert.equal(intent.extras.text,'Score\nhttps://example.com');
  assert.equal(intent.extras.stream.authority,'test.game.haiyue.share');assert.equal(intent.clip.uri,intent.extras.stream);
  assert.equal(intent.flags,1);assert.equal(chooser.flags,1);assert.equal(f.writes[0][0],-119);
  await assert.rejects(f.shareContent({text:'again'}),e=>e.code==='busy');f.emit(code+1);assert.equal(f.listeners.size,1);
  f.emit(code);assert.equal((await run).status,'presented');assert.equal(f.listeners.size,0);assert.equal(f.exits.size,0);
  assert.ok(f.entries.has(intent.extras.stream.path));
});
test('Android rejects missing provider, cleans launch failures and permits retry', async () => {
  const f=android();f.setProvider(false);assert.equal(f.canShareContent({image:image()}),false);
  await assert.rejects(f.shareContent({image:image()}),e=>e.code==='unavailable');assert.equal(f.entries.size,0);
  f.setProvider(true);f.setFail(true);await assert.rejects(f.shareContent({image:image()}),e=>e.code==='failed');
  assert.equal([...f.entries.keys()].filter(p=>p.endsWith('.png')).length,0);assert.equal(f.listeners.size,0);
  f.setFail(false);const run=f.shareContent({text:'again'});f.emit(f.opened[0].code);assert.equal((await run).status,'presented');
});
test('Android prunes only expired share directories and releases listeners on host exit', async () => {
  const f=android();f.entries.set('/cache/haiyue-share/share-1-1',{folder:true,time:1});f.entries.set('/cache/haiyue-share/share-1-1/old.png',{time:1});
  f.entries.set('/cache/haiyue-share/unrelated',{folder:true,time:1});
  const run=f.shareContent({image:image()});assert.equal(f.entries.has('/cache/haiyue-share/share-1-1'),false);assert.equal(f.entries.has('/cache/haiyue-share/unrelated'),true);
  for(const exit of [...f.exits])exit();await assert.rejects(run,e=>e.code==='unavailable');assert.equal(f.listeners.size,0);assert.equal(f.exits.size,0);
});
