import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {inflateSync,crc32} from 'node:zlib';
import * as ns from './fake-native.mjs';
const ui=path.resolve(process.env.HAIYUE_UI_TEST_DIST ?? 'artifacts/ui-validation/mobile/node_modules/@haiyue/ui/dist');
const core=await import(pathToFileURL(path.join(ui,'core/index.js'))),portable=await import(pathToFileURL(path.join(ui,'portable/index.js')));
const natives={...ns};
const mocks={'@nativescript/core':natives,'@haiyue/ui/core':core,'@haiyue/ui/portable':portable,'./platform':ns.platform};
const cache=new Map();
function loadTS(file) {
  file=path.resolve(file);if(cache.has(file))return cache.get(file);
  const exports={};cache.set(file,exports);
  const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  // Same realm as the real package: its plain-data guard deliberately rejects foreign VM prototypes.
  new Function('require','exports',code)(name=>name in mocks?mocks[name]:loadTS(path.join(path.dirname(file),name+'.ts')),exports);return exports;
}
const {HYNativeScriptRenderer}=loadTS('bridge/ui/nativescript/renderer.ts',mocks);
const {initialState,scenario}=loadTS('examples/ui-validation/mobile/src/scenario.ts',mocks);
const n=core.hyNode;
test('Android keyboard observer detaches after attach merges its tree and ignores queued callbacks',()=>{
  const exports={},code=ts.transpileModule(readFileSync('bridge/ui/nativescript/platform.android.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const android={os:{Build:{VERSION:{SDK_INT:30}}},view:{WindowInsets:{Type:{ime:()=>1}},ViewTreeObserver:{OnGlobalLayoutListener:class{constructor(callbacks){Object.assign(this,callbacks);}}}}};
  new Function('require','exports','android',code)(()=>({Utils:{layout:{toDeviceIndependentPixels:n=>n}}}),exports,android);
  let alive=true,destroyed=false,listener;const retained=new Set(),heights=[];
  const attached={isAlive:()=>true,removeOnGlobalLayoutListener:l=>retained.delete(l)};
  const original={isAlive:()=>alive,addOnGlobalLayoutListener:l=>{listener=l;retained.add(l);},removeOnGlobalLayoutListener:l=>retained.delete(l)};
  const native={getViewTreeObserver:()=>alive?original:attached,getRootWindowInsets:()=>{assert.equal(destroyed,false);return {isVisible:()=>false};}};
  const dispose=exports.observeKeyboard({android:native},height=>heights.push(height));
  alive=false;listener.onGlobalLayout();assert.deepEqual(heights,[0]);
  dispose();assert.equal(retained.size,0);destroyed=true;
  assert.doesNotThrow(()=>listener.onGlobalLayout());dispose();assert.deepEqual(heights,[0]);
});
test('embedded image fixture has valid PNG checksums and decodable pixel data',()=>{
  const source=readFileSync('examples/ui-validation/mobile/src/app.ts','utf8');
  const bytes=Buffer.from(source.match(/fromBase64Sync\('([^']+)/)[1],'base64');
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const data=[];
  for(let i=8;i<bytes.length;){const n=bytes.readUInt32BE(i),end=i+8+n;assert.equal(crc32(bytes.subarray(i+4,end)),bytes.readUInt32BE(end));if(bytes.toString('ascii',i+4,i+8)==='IDAT')data.push(bytes.subarray(i+8,end));i=end+4;}
  assert.equal(inflateSync(Buffer.concat(data)).length,5); // One filter byte and one RGBA pixel.
});
function fixture(tree,accept,options={}){
  const events=[],host=new ns.GridLayout();host.load();
  const renderer=new HYNativeScriptRenderer(host,{resolveResource:()=>'/fixture.png',platformViews:{preview:()=>resource(),editor:()=>resource()},...options});
  const page=new portable.HYPage(renderer,{onEvent:e=>{events.push(e);accept?.(e,page);}});page.mount(tree);
  return {host,renderer,page,events,view:key=>ns.find(host,key),dispose(){page.dispose();assert.equal(renderer.diagnostics.activeListeners,0);assert.equal(renderer.diagnostics.activeNodes,0);assert.equal(renderer.diagnostics.activeResources,0);assert.equal(renderer.diagnostics.activeTimers,0);assert.equal(ns.bindings.size,0);}};
}
function resource(){return {mount(){},update(){},layout(){},visible(){},focus(){},dispose(){}};}
test('all 18 kinds mount from the independent shared package; unrelated updates preserve instances',async()=>{
  const state=initialState(),f=fixture(scenario(state));await ns.drain();
  const input=f.view('/screen/scroll/body/name/title'),editor=f.view('/screen/scroll/body/editor');
  assert.equal(input.accessibilityValue,undefined);
  const status=f.view('/screen/status'),descriptions=[];
  Object.defineProperty(status,'accessibilityLabel',{configurable:true,set(label){descriptions.push({label,text:this.text});}});
  state.count++;f.page.render(scenario(state));assert.equal(f.view(input.id),input);assert.equal(f.view(editor.id),editor);
  assert.equal(descriptions.at(-1).label,descriptions.at(-1).text);
  assert.equal(f.events.length,0);assert.equal(f.renderer.diagnostics.activeResources,2);f.dispose();
});
test('Android uses an explicit image fallback without requesting iOS system symbols',async()=>{
  natives.isIOS=false;
  try {const f=fixture(scenario(initialState()));await ns.drain();assert.ok(!f.renderer.capabilities.features.includes('icons.system'));f.dispose();}
  finally{natives.isIOS=true;}
});
test('programmatic toggle/text/slider writes and delayed setter echoes emit no application actions',async()=>{
  const tree=value=>n('Column','root',{}, {children:[n('Toggle','toggle',{checked:value}),n('TextInput','text',{value:String(value)}),n('Slider','slider',{value:value?60:20,min:0,max:100,step:5})]});
  const f=fixture(tree(false));await ns.drain();f.page.render(tree(true));
  f.view('/root/toggle').notify('checkedChange',{value:true});f.view('/root/text').notify('nativeInput');f.view('/root/slider').notify('valueChange',{value:12});
  assert.equal(f.events.length,0);f.dispose();
});
test('Chinese composition is kept across unrelated renders; candidate confirmation does not commit',async()=>{
  const tree=(value,other=0)=>n('Column','root',{}, {children:[n('TextInput','input',{value}),n('Text','counter',{text:String(other)})]});
  const f=fixture(tree('初始')),input=f.view('/root/input');await ns.drain();
  input.composing=true;input.text='初始ni';input.notify('nativeInput');
  f.page.render(tree('初始',1));assert.equal(input.text,'初始ni');
  input.notify('returnPress');assert.equal(f.events.filter(e=>e.type==='commit').length,0);
  input.composing=false;input.text='初始你';input.notify('nativeInput');input.notify('returnPress');input.notify('blur');
  assert.deepEqual(f.events.filter(e=>e.type.startsWith('composition')).map(e=>e.type),['compositionStart','compositionUpdate','compositionEnd']);
  assert.equal(f.events.filter(e=>e.type==='commit').length,1);assert.equal(f.events.find(e=>e.type==='commit').value,'初始你');f.dispose();
});
test('new authoritative text wins only after marked text is complete; disposed callbacks are inert',async()=>{
  const tree=value=>n('TextInput','input',{value});const f=fixture(tree('old')),input=f.view('/input');await ns.drain();
  input.composing=true;input.text='ni';input.notify('nativeInput');f.page.render(tree('server'));assert.equal(input.text,'ni');
  input.composing=false;input.text='你';input.notify('nativeInput');assert.equal(input.text,'server');f.dispose();const count=f.events.length;input.notify('nativeInput');assert.equal(f.events.length,count);
});
test('rejected toggle returns to accepted value and accepted slider commits once',async()=>{
  const tree=value=>n('Column','root',{}, {children:[n('Toggle','toggle',{checked:false}),n('Slider','slider',{value,min:0,max:1,step:0.25})]});
  const f=fixture(tree(0),(event,page)=>{if(event.type==='commit'&&event.key.endsWith('/slider'))page.render(tree(event.value));});await ns.drain();
  f.view('/root/toggle').checked=true;assert.equal(f.view('/root/toggle').checked,false);
  const slider=f.view('/root/slider');slider.notify('touch',{action:'down'});slider.value=3;slider.notify('touch',{action:'up'});slider.notify('touch',{action:'up'});
  assert.equal(f.events.filter(e=>e.key.endsWith('/slider')&&e.type==='commit').length,1);assert.equal(f.events.find(e=>e.key.endsWith('/slider')&&e.type==='commit').value,0.75);f.dispose();
});
test('stable keys move instances; hidden tabs cannot send actions',async()=>{
  const tree=order=>n('Column','root',{}, {children:order.map(k=>n('Button',k,{text:k}))});
  const f=fixture(tree(['a','b'])),a=f.view('/root/a');f.page.render(tree(['b','a']));assert.equal(f.view('/root/a'),a);assert.equal(f.renderer.diagnostics.moved,1);f.dispose();
  const g=fixture(scenario(initialState()));const status=g.events.length;g.view('/screen/scroll/body/tabs/preview/badge').notify('tap');assert.equal(g.events.length,status);g.dispose();
});
test('dialog programmatic close does not cancel; user close cancels and restores focus',async()=>{
  const tree=open=>n('Column','root',{}, {children:[n('Button','open',{text:'Open'}),n('Dialog','dialog',{open,title:'Modal'}, {children:[n('TextInput','inside',{value:''})]})]});
  const f=fixture(tree(false),(e,page)=>{if(e.type==='cancel')page.render(tree(false));});f.page.focus('/root/open');f.page.render(tree(true));await ns.drain();
  const dialog=f.host.children[0].modal;assert.ok(dialog);f.page.render(tree(false));assert.equal(f.events.filter(e=>e.type==='cancel').length,0);
  f.page.render(tree(true));await ns.drain();f.host.children[0].modal.closeModal();await ns.drain();assert.equal(f.events.filter(e=>e.type==='cancel').length,1);assert.ok(f.view('/root/open').focused);f.dispose();
});
test('50 mount/unmount cycles release root observers, native input bindings and resources',async()=>{
  for(let i=0;i<50;i++){const f=fixture(scenario(initialState()));await ns.drain();f.page.suspend();f.page.resume();f.dispose();assert.equal(f.host.children.length,0);}
  assert.equal([...ns.Application.handlers.values()].reduce((n,s)=>n+s.size,0),0);
});
test('rapid dialog reopen waits for the native asynchronous dismissal callback',async()=>{
  const tree=open=>n('Dialog','dialog',{open,title:'Modal'}, {children:[n('Button','close',{text:'Close'})]});
  const f=fixture(tree(true));await ns.drain();
  const owner=f.host.children[0],dialog=owner.modal;assert.ok(dialog instanceof ns.Page);
  const card=dialog.content.children[0];assert.equal(card.content.style.paddingLeft,20);
  assert.equal(card.width,'100%');assert.equal(card.maxWidth,460);assert.equal(card.verticalAlignment,'middle');
  dialog.content.notify('layoutChanged');assert.equal(card.maxHeight,44);
  assert.equal(dialog.modalOptions.ios.presentationStyle,5);
  let complete;const close=dialog.closeModal.bind(dialog);
  dialog.closeModal=()=>{complete=close;};
  let presentations=0;const show=owner.showModal.bind(owner);
  owner.showModal=(...args)=>{presentations++;show(...args);};
  f.page.render(tree(false));f.page.render(tree(true));await ns.drain();
  assert.equal(presentations,0);assert.equal(owner.modal,dialog);
  complete();await ns.drain();assert.equal(presentations,1);assert.equal(owner.modal,dialog);
  assert.equal(f.events.filter(e=>e.type==='cancel').length,0);
  dialog.closeModal=close;f.dispose();
});
test('capability failures identify a node and a failed renderer is disposable',()=>{
  const host=new ns.GridLayout(),renderer=new HYNativeScriptRenderer(host);const page=new portable.HYPage(renderer);
  assert.throws(()=>page.mount(n('PlatformView','preview',{slot:'missing',resourceId:'id'})),/failed/);page.dispose();assert.equal(renderer.diagnostics.activeListeners,0);
});
test('throwing product disposers still release every observer and sibling',async()=>{
  const host=new ns.GridLayout();host.load();
  const renderer=new HYNativeScriptRenderer(host,{platformViews:{broken:()=>({...resource(),dispose(){throw Error('product cleanup failed');}})}});
  const page=new portable.HYPage(renderer);page.mount(n('Column','root',{}, {children:[n('PlatformView','bad',{slot:'broken',resourceId:'id'}),n('TextInput','input',{value:''})]}));await ns.drain();
  assert.throws(()=>page.dispose(),/cleanup/);assert.equal(renderer.diagnostics.activeListeners,0);assert.equal(ns.bindings.size,0);assert.equal(host.children.length,0);
});
test('native Select cancel/reopen, stale resolution and option choice preserve controlled value',async()=>{
  const options=[{value:'a',label:'A'},{value:'b',label:'B'}],tree=value=>n('Select','choice',{value,options});
  const f=fixture(tree('a'),(e,page)=>{if(e.type==='commit')page.render(tree(e.value));});await ns.drain();const select=f.view('/choice');
  select.notify('tap');assert.ok(select.modal);select.modal.closeModal();await ns.drain();assert.equal(f.events.filter(e=>e.type==='commit').length,0);
  select.notify('tap');select.modal.content.children[0].content.children[2].notify('tap');await ns.drain();assert.equal(select.modal,undefined);assert.equal(select.text,'B');assert.equal(f.events.filter(e=>e.type==='commit').length,1);
  select.notify('tap');f.page.render(tree('a'));await ns.drain();assert.equal(select.modal,undefined);assert.equal(select.text,'A');f.dispose();
});
test('optional mobile entry does not pollute root or system exports',()=>{
  const pkg=JSON.parse(readFileSync('npm/package.json'));assert.equal(pkg.peerDependenciesMeta['@haiyue/ui'].optional,true);assert.equal(pkg.dependencies?.['@haiyue/ui'],undefined);
  assert.equal(pkg.exports['./ui'].default,'./bridge/ui/index.ts');assert.doesNotMatch(readFileSync('npm/index.ts','utf8'),/bridge\/ui/);
  for(const file of ['bridge/ui/index.ts','bridge/ui/nativescript/renderer.ts','bridge/ui/nativescript/controls.ts'])assert.doesNotMatch(readFileSync(file,'utf8'),/@haiyue\/engine|\.\.\/\.\.\/\.\.\/UI/);
});

test('leaf value changes preserve native layout and typography while accessibility stays current',async()=>{
  const options=[{value:'a',label:'A'},{value:'b',label:'B'}];
  const tree=value=>n('Column','root',{}, {children:[n('Select','choice',{value,options,a11y:{label:'Resolution'}}),n('Text','status',{text:'Ready'})]});
  const f=fixture(tree('a'));await ns.drain();
  const choice=f.view('/root/choice'),status=f.view('/root/status');let geometry=0,typography=0,relations=0;
  for(const view of [choice,status]){
    let width=view.width;Object.defineProperty(view,'width',{configurable:true,get:()=>width,set:v=>{geometry++;width=v;}});
    view.style=new Proxy(view.style,{set(target,key,value){if(key==='fontSize'||key==='color')typography++;target[key]=value;return true;}});
  }
  const setRow=ns.GridLayout.setRow;ns.GridLayout.setRow=(...args)=>{relations++;setRow(...args);};
  try {
    f.page.render(tree('b'));await ns.drain();
    assert.equal(choice.text,'B');assert.equal(choice.accessibilityLabel,'Resolution');assert.equal(choice.accessibilityValue,'b');
    assert.equal(geometry,0);assert.equal(typography,0);assert.equal(relations,0);
  }finally{ns.GridLayout.setRow=setRow;f.dispose();}
});
test('layout, clipping, environment and visibility changes still reach native controls',async()=>{
  const tree=(width,clip,visible)=>n('Column','root',{}, {children:[n('Button','button',{text:'Action',visible,layout:{width,clip}})]});
  const f=fixture(tree(100,false,true));await ns.drain();const button=f.view('/root/button');
  f.page.render(tree(180,true,false));await ns.drain();assert.equal(button.width,180);assert.equal(button.clip,true);assert.equal(button.visibility,'collapse');
  f.renderer.setEnvironment({fontScale:2});assert.equal(button.fontSize,32);
  f.page.render(tree(100,false,true));await ns.drain();assert.equal(button.width,100);assert.equal(button.clip,false);assert.equal(button.visibility,'visible');
  // Native views can be recreated without a semantic props change.
  button.unload();button.clip=true;button.load();assert.equal(button.clip,false);f.dispose();
});
test('form labels and errors survive leaf changes and update with the parent',async()=>{
  const tree=(value,label='Name',error='Required')=>n('FormGroup','group',{label,error},{children:[n('TextInput','input',{value})]});
  const f=fixture(tree(''));await ns.drain();const input=f.view('/group/input');
  f.page.render(tree('Alice'));assert.equal(input.accessibilityLabel,'Name');assert.equal(input.accessibilityHint,'Required');
  f.page.render(tree('Alice','Author',''));assert.equal(input.accessibilityLabel,'Author');assert.equal(input.accessibilityHint,'');f.dispose();
});

test('clipped PlatformView refreshes its native rectangle after hidden layout becomes visible',async()=>{
  const previous=ns.platform.setClipping;let width=0;
  ns.platform.setClipping=(view,clip)=>{previous(view,clip);view.clipWidth=width;};
  const f=fixture(n('PlatformView','editor',{slot:'editor',resourceId:'draft',layout:{clip:true}}));
  try{
    await ns.drain();const view=f.view('/editor');assert.equal(view.clipWidth,0);
    width=320;view.notify('layoutChanged');await ns.drain();assert.equal(view.clipWidth,320);
    width=640;view.notify('layoutChanged');await ns.drain();assert.equal(view.clipWidth,640);
  }finally{f.dispose();ns.platform.setClipping=previous;}
});

test('native leaf updates compare immutable props without serializing the control tree',async()=>{
 const tree=value=>n('Select','choice',{value,options:[{value:'a',label:'A'},{value:'b',label:'B'}],layout:{width:100},a11y:{label:'Resolution'}});
 const f=fixture(tree('a'));await ns.drain();const next=tree('b'),stringify=JSON.stringify;
 try {
  JSON.stringify=()=>{throw Error('leaf update must not serialize props');};
  f.page.render(next);assert.equal(f.view('/choice').text,'B');assert.equal(f.view('/choice').accessibilityValue,'b');
 } finally {JSON.stringify=stringify;f.dispose();}
});

test('value-only commits avoid redundant layout timers but real native layout still refreshes PlatformView bounds',async()=>{
 const tree=value=>n('Column','root',{}, {children:[n('Select','choice',{value,options:[{value:'a',label:'A'},{value:'b',label:'B'}],layout:{width:100}}),n('PlatformView','preview',{slot:'preview',resourceId:'one',layout:{clip:true}})]});
 const f=fixture(tree('a'));await ns.drain();assert.equal(f.renderer.diagnostics.activeTimers,0);
 f.page.render(tree('b'));assert.equal(f.renderer.diagnostics.activeTimers,0);assert.equal(f.view('/root/choice').text,'B');
 f.view('/root/preview').notify('layoutChanged');assert.equal(f.renderer.diagnostics.activeTimers,1);
 await ns.drain();assert.equal(f.renderer.diagnostics.activeTimers,0);f.dispose();
});

test('accessibility value updates skip unchanged UIKit fields and preserve Android derived labels',async()=>{
 for(const ios of [true,false]){
  natives.isIOS=ios;
  const tree=value=>n('Select','choice',{value,options:[{value:'a',label:'A'},{value:'b',label:'B'}],a11y:{label:'Resolution',description:'Choose scale'}});
  const f=fixture(tree('a'));await ns.drain();const view=f.view('/choice'),writes=[];
  for(const key of ['accessibilityLabel','accessibilityHint','accessibilityRole','accessibilityState','accessibilityValue']){
   let value=view[key];Object.defineProperty(view,key,{configurable:true,get:()=>value,set:next=>{writes.push(key);value=next;}});
  }
  try{f.page.render(tree('b'));assert.deepEqual(writes,ios?['accessibilityValue']:['accessibilityLabel','accessibilityValue']);assert.equal(view.accessibilityLabel,'Resolution');assert.equal(view.accessibilityValue,'b');}
  finally{f.dispose();natives.isIOS=true;}
 }
});


test('iOS single-line controls avoid paragraph titles while multiline and Android keep theme spacing',async()=>{
 const tree=n('Column','root',{}, {children:[n('Button','action',{text:'Action'}),n('Select','choice',{value:'a',options:[{value:'a',label:'A'}]}),n('Text','body',{text:'Two\nlines',wrap:true}),n('TextArea','editor',{value:'Two\nlines'})]});
 for(const ios of [true,false]){
  natives.isIOS=ios;const f=fixture(tree);await ns.drain();
  try{
   const button=f.view('/root/action'),choice=f.view('/root/choice');
   assert.equal(button.lineHeight,ios?0:8);assert.equal(choice.lineHeight,ios?0:8);
   assert.equal(button.minHeight,44);assert.equal(f.view('/root/body').lineHeight,8);assert.equal(f.view('/root/editor').lineHeight,8);
   button.whiteSpace='normal';f.renderer.setEnvironment({fontScale:2});
   assert.equal(button.lineHeight,16);assert.equal(button.fontSize,32);assert.equal(choice.lineHeight,ios?0:16);
   assert.equal(f.view('/root/editor').lineHeight,16);
  }finally{f.dispose();natives.isIOS=true;}
 }
});

test('theme owns button geometry and picker colours after an environment change',async()=>{
  const f=fixture(n('Column','screen',{}, {children:[n('Button','run',{text:'Run'}),n('Select','scale',{value:'1',options:[{value:'1',label:'100%'},{value:'0.5',label:'50%'}]})]}),undefined,{selectionCancelLabel:'取消'});
  try {
    const theme={color:{text:'#eef0ff',muted:'#a9add4',surface:'#10132f',input:'#0c1029',accent:'#8177f2',danger:'#dd6f91',border:'#343765',focus:'#9c8fff'},fontSize:14,lineHeight:20,gap:8,radius:8};
    f.renderer.setEnvironment({theme});await ns.drain();
    const button=f.view('/screen/run');assert.equal(button.margin,0);assert.equal(button.borderRadius,8);assert.equal(button.borderWidth,1);assert.equal(button.backgroundColor.value,theme.color.surface);
    const picker=f.view('/screen/scale');picker.notify('tap');await ns.drain();
    assert.ok(picker.modal,'select opens a themed native modal');
    const panel=picker.modal.content.children[0].content;assert.equal(panel.backgroundColor.value,theme.color.surface);assert.equal(panel.children.at(-1).text,'取消');
    assert.equal(panel.children[1].backgroundColor.value,theme.color.accent);
    assert.equal(panel.children[2].backgroundColor.value,'transparent');
    assert.equal(panel.children[2].color.value,theme.color.text);
  }finally{f.dispose();}
});

test('dialog backdrop ignores taps inside the card and respects dismissible=false',async()=>{
  for(const dismissible of [true,false]){
    const f=fixture(n('Dialog','dialog',{open:true,title:'Settings',dismissible}));await ns.drain();
    try{const overlay=f.host.children[0].modal.content;
      overlay.notify('tap',{getX:()=>10,getY:()=>10});assert.equal(f.events.length,0);
      overlay.notify('tap',{getX:()=>310,getY:()=>10});assert.equal(f.events.filter(e=>e.type==='cancel').length,dismissible?1:0);
    }finally{f.dispose();}
  }
});

test('catalog checkbox/radio/rating use controlled transactions and release option handlers',async()=>{
  const tree=(checked=false,choice='a',rating=2,options=[{value:'a',label:'A'},{value:'b',label:'B'},{value:'c',label:'C',disabled:true}])=>n('Column','root',{}, {children:[
    n('Checkbox','check',{text:'Accept',checked}),n('RadioGroup','radio',{value:choice,options}),n('Rate','rate',{value:rating,count:5}),n('Badge','badge',{text:'NEW'}),n('Divider','divider',{text:'Details'})]});
  const f=fixture(tree());await ns.drain();
  f.view('/root/check').notify('tap');assert.deepEqual(f.events.filter(e=>e.type==='commit').map(e=>e.value),[true]);assert.match(f.view('/root/check').text,/☐/);
  const radio=f.view('/root/radio');assert.equal(radio.children[2].accessible,true);assert.equal(radio.children[2].accessibilityState,'disabled');radio.children[1].notify('tap');radio.children[2].notify('tap');
  const rate=f.view('/root/rate');rate.children[3].notify('tap');
  assert.deepEqual(f.events.filter(e=>e.type==='commit').map(e=>e.value),[true,'b',4]);assert.equal(rate.children[3].text,'☆');
  const removed=radio.children[1];f.page.render(tree(true,'a',4,[{value:'a',label:'A'}]));removed.notify('tap');assert.equal(f.events.filter(e=>e.type==='commit').length,3);
  assert.match(f.view('/root/check').text,/☑/);assert.equal(rate.children[3].text,'★');f.page.setProps('/root/divider','Divider',{});assert.equal(f.view('/root/divider').height,1);f.page.setProps('/root/divider','Divider',{text:'More'});assert.ok(f.view('/root/divider').height>1);f.dispose();removed.notify('tap');
});
test('catalog pages cycle through every section and release fifty times',async()=>{
  for(let i=0;i<50;i++){const state={...initialState(),gallery:true,section:['forms','feedback','patterns'][i%3],expanded:i%2===0};const f=fixture(scenario(state));await ns.drain();f.dispose();}
});

test('vector button variants preserve the native Button while busy and after resume',async()=>{
 const theme={color:{text:'#eeeeee',muted:'#999999',surface:'#151515',input:'#222222',accent:'#7777ff',danger:'#ff5555',border:'#444444',focus:'#9999ff',selected:'#5555bb',pressed:'#333355',elevated:'#292929',onAccent:'#ffffff'},fontSize:14,lineHeight:20,gap:8,radius:8,typography:{title:{fontSize:24,lineHeight:32,weight:'bold'},caption:{fontSize:12,lineHeight:18}}};
 const tree=(busy=false,variant='primary')=>n('Column','root',{}, {children:[n('Button','save',{text:'',icon:'save',variant,busy,a11y:{label:'Save'}}),n('Text','title',{text:'Title',textStyle:'title'}),n('Text','caption',{text:'Hint',textStyle:'caption',tone:'muted'})]});
 const f=fixture(tree(),undefined,{environment:{theme}});await ns.drain();
 try {
  const button=f.view('/root/save');assert.ok(button instanceof ns.Button);assert.equal(button.minHeight,44);assert.equal(button.adornment.icon,'save');assert.equal(button.backgroundColor.value,theme.color.accent);
  assert.equal(f.view('/root/title').fontSize,24);assert.equal(f.view('/root/caption').color.value,theme.color.muted);
  f.page.render(tree(true));assert.equal(f.view('/root/save'),button);assert.equal(button.adornment.busy,true);button.notify('tap');assert.equal(f.events.filter(e=>e.type==='activate').length,0);
  f.page.suspend();assert.equal(button.adornment,undefined);f.page.resume();assert.equal(button.adornment.busy,true);
  f.page.render(tree(false,'quiet'));assert.equal(button.backgroundColor.value,'transparent');assert.equal(button.borderWidth,0);button.notify('tap');assert.equal(f.events.filter(e=>e.type==='activate').length,1);
  f.renderer.setEnvironment({theme,fontScale:1.5});assert.equal(f.view('/root/title').fontSize,36);assert.equal(button.fontSize,21);
 }finally{f.dispose();}
});
test('Tabs have distinct segmented and underline selection and keep disabled options inert',async()=>{
 const options=[{value:'a',label:'A'},{value:'b',label:'B',disabled:true}],tree=variant=>n('Tabs','tabs',{value:'a',options,variant});
 const f=fixture(tree('segmented'));await ns.drain();
 try {const row=f.view('/tabs').children[0],selected=row.children[0];assert.equal(selected.accessibilityState,'selected');assert.equal(selected.borderBottomWidth,0);assert.notEqual(selected.backgroundColor.value,'transparent');row.children[1].notify('tap');assert.equal(f.events.filter(e=>e.type==='commit').length,0);
  f.page.render(tree('underline'));assert.equal(row.children[0],selected);assert.equal(selected.borderBottomWidth,2);assert.equal(selected.backgroundColor.value,'transparent');
 }finally{f.dispose();}
});
test('Select stays anchored below its control on both wide and narrow surfaces',async()=>{
 const f=fixture(n('Select','choice',{value:'a',options:[{value:'a',label:'A'}],a11y:{label:'Language'}}));await ns.drain();
 try{const choice=f.view('/choice');choice.notify('tap');const overlay=choice.modal.content,card=overlay.children[0];overlay.getActualSize=()=>({width:1000,height:800});overlay.notify('layoutChanged');await ns.drain();assert.equal(card.verticalAlignment,'top');assert.equal(card.width,300);
  choice.getLocationInWindow=()=>({x:20,y:200});overlay.getActualSize=()=>({width:390,height:700});overlay.notify('layoutChanged');await ns.drain();assert.equal(card.verticalAlignment,'top');assert.equal(card.width,300);assert.equal(card.marginTop,240);
 }finally{f.dispose();}
});

test('Select waits until after the native layout pass and cancels pending positioning on disposal',async()=>{
 const tree=n('Select','choice',{value:'a',options:[{value:'a',label:'A'}]});
 const f=fixture(tree);await ns.drain();const choice=f.view('/choice');choice.notify('tap');const overlay=choice.modal.content,card=overlay.children[0];let bounds={width:0,height:0};overlay.getActualSize=()=>bounds;
 overlay.notify('layoutChanged');assert.equal(card.verticalAlignment,'middle');bounds={width:1000,height:800};await ns.drain();assert.equal(card.verticalAlignment,'top');assert.equal(card.width,300);
 bounds={width:390,height:700};overlay.notify('layoutChanged');f.dispose();await ns.drain();assert.equal(card.verticalAlignment,'top','disposed modal must not run its queued layout');
});

const {hyShowNativeOverlay}=loadTS('bridge/ui/nativescript/overlay.ts');
const {HYNativeFormField}=loadTS('bridge/ui/nativescript/form.ts');
const {HYNativeCardGrid,HYNativeWorkspace}=loadTS('bridge/ui/nativescript/responsive.ts');
const p1Theme={color:{text:'#eeeeee',muted:'#999999',surface:'#151515',input:'#222222',accent:'#7777ff',danger:'#ff5555',border:'#444444',focus:'#9999ff'},fontSize:14,lineHeight:20,gap:8,radius:8};
const {hyPickNativeOption}=loadTS('bridge/ui/nativescript/selection.ts');
test('anchored menus use available space below and explicit sheets remain opt-in',async()=>{
 const anchor=new ns.Button();anchor.load();let y=360;anchor.getLocationInWindow=()=>({x:200,y});anchor.getActualSize=()=>({width:200,height:44});
 const picker=hyPickNativeOption(anchor,{title:'Menu',value:'a',options:[{value:'a',label:'A'}],theme:p1Theme});const overlay=anchor.modal.content,card=overlay.children[0];overlay.getActualSize=()=>({width:390,height:600});card.content.getActualSize=()=>({width:200,height:320});overlay.notify('layoutChanged');await ns.drain();
 assert.equal(card.marginTop+16,y+44+6);assert.equal(card.maxHeight,174,'long menus scroll beneath the field');assert.ok(card.marginLeft+16+card.width<=374);
 y=560;overlay.notify('layoutChanged');await ns.drain();assert.ok(card.marginTop+16+card.maxHeight<=y-6,'near the bottom, keep the menu next to the field and on screen');
 ns.keyboardCallbacks.get(overlay)(200);await ns.drain();assert.ok(card.marginTop+16+card.maxHeight<=384,'keyboard avoidance keeps every menu row reachable by scrolling');picker.cancel();await picker.result;
 const sheet=hyPickNativeOption(anchor,{title:'Explicit sheet',value:'a',options:[{value:'a',label:'A'}],theme:p1Theme,presentation:'sheet'});sheet.cancel();await sheet.result;assert.equal(ns.bindings.size,0);
});
test('Select does not expose its default frame before the final native layout is valid',async()=>{
 for(const width of [390,1180]){
  const anchor=new ns.Button();anchor.load();
  const picker=hyPickNativeOption(anchor,{title:'Language',value:'a',options:[{value:'a',label:'A'},{value:'b',label:'B'}],theme:p1Theme});
  const modal=anchor.modal,overlay=modal.content,card=overlay.children[0],content=card.content;
  assert.equal(card.opacity,0,'default centered card must not be painted');assert.equal(card.accessibilityHidden,true);assert.equal(card.isUserInteractionEnabled,false);
  assert.equal(modal.backgroundColor.value,'rgba(0,0,0,0.32)','backdrop must not change after the first frame');
  let bounds={width:0,height:0};overlay.getActualSize=()=>bounds;overlay.notify('layoutChanged');await ns.drain();assert.equal(card.opacity,0);
  bounds={width,height:800};card.isLayoutValid=content.isLayoutValid=false;overlay.notify('layoutChanged');await ns.drain();
  assert.equal(card.verticalAlignment,'top');assert.equal(card.opacity,0,'positioning still needs a native layout pass');
  card.isLayoutValid=true;card.notify('layoutChanged');await ns.drain();assert.equal(card.opacity,0,'wrapped option content is not ready yet');
  content.isLayoutValid=true;await new Promise(resolve=>setTimeout(resolve,40));assert.equal(card.opacity,1,'an unchanged final rectangle need not emit layoutChanged');assert.equal(card.accessibilityHidden,false);assert.equal(card.isUserInteractionEnabled,true);
  picker.cancel();assert.equal(await picker.result,null);assert.equal(ns.bindings.size,0);
 }
});
test('host overlay first layout is hidden, and dismissal cancels its pending reveal',async()=>{
 const owner=new ns.Page();owner.load();const handle=hyShowNativeOverlay(owner,{title:'Settings',content:new ns.StackLayout(),theme:p1Theme});
 const overlay=handle.page.content,card=overlay.children[0];overlay.getActualSize=()=>({width:390,height:800});card.isLayoutValid=false;
 assert.equal(card.opacity,0);overlay.notify('layoutChanged');await ns.drain();assert.equal(card.opacity,0);
 card.isLayoutValid=true;card.notify('layoutChanged');handle.close();await handle.closed;await ns.drain();assert.equal(card.opacity,0);assert.equal(ns.bindings.size,0);
});
test('common dialog/drawer shell pins actions, dismisses outside, waits for native close and releases keyboard observers',async()=>{
 for(const kind of ['dialog','drawer','sheet']){
  const owner=new ns.Page(),anchor=new ns.Button(),content=new ns.StackLayout(),footer=new ns.Button();owner.load();anchor.load();let releases=0;
  const handle=hyShowNativeOverlay(owner,{title:'Settings',content,footer,kind,theme:p1Theme,returnFocus:anchor,onClosed:()=>releases++});
  const overlay=handle.page.content,card=overlay.children[0];overlay.getActualSize=()=>({width:1180,height:760});overlay.notify('layoutChanged');await ns.drain();
  assert.equal(card.width,kind==='drawer'?590:560);assert.equal(card.horizontalAlignment,kind==='drawer'?'right':'center');assert.equal(card.height,kind==='drawer'?760:620);assert.equal(overlay.iosOverflowSafeArea,false);assert.equal(card.content.iosOverflowSafeArea,false);assert.equal(card.content.height,card.height);assert.equal(card.content.children[1].content,content);assert.equal(card.content.children[2].children[0],footer);
  handle.setTitle('Updated');assert.equal(handle.page.accessibilityLabel,'Updated');overlay.notify('tap',{getX:()=>1000,getY:()=>700});await handle.closed;assert.equal(releases,1);handle.close();assert.equal(releases,1);assert.equal(anchor.focused,true);assert.equal(ns.bindings.size,0);
 }
});
test('non-dismissible shell blocks backdrop and owner navigation cancels; custom bodies retain their native view',async()=>{
 const owner=new ns.Page(),body=new ns.GridLayout();owner.load();const handle=hyShowNativeOverlay(owner,{title:'Source',content:body,scrollable:false,dismissible:false,theme:p1Theme});
 const overlay=handle.page.content,card=overlay.children[0];overlay.notify('tap',{getX:()=>1000,getY:()=>700});assert.equal(owner.modal,handle.page);assert.equal(card.content.children[1],body);owner.notify('navigatingFrom');await handle.closed;assert.equal(owner.modal,undefined);assert.equal(ns.bindings.size,0);
});
test('form metadata updates preserve composing text and expose help and errors to accessibility',()=>{
 const input=new ns.TextField();input.text='ni';input.composing=true;const field=new HYNativeFormField(input,{label:'Name',description:'Visible help'},p1Theme);
 assert.equal(input.text,'ni');field.update({label:'作品名称',description:'帮助',error:'不能为空'});assert.equal(input.text,'ni');assert.equal(input.composing,true);assert.equal(input.accessibilityHint,'帮助. 不能为空');assert.equal(input.borderColor.value,p1Theme.color.danger);
 field.update({label:'Name'});assert.equal(input.accessibilityHint,'');assert.equal(input.borderColor.value,p1Theme.color.border);
 const toggle=new ns.Switch();toggle.checked=true;const inline=new HYNativeFormField(toggle,{label:'MSAA',inline:true},p1Theme);assert.equal(toggle.checked,true);assert.equal(toggle.minHeight,0);assert.equal(inline.rows,'44,auto,auto');assert.equal(toggle.backgroundColor,undefined);assert.equal(toggle.column,1);assert.equal(inline.children[2].columnSpan,2);
});
test('responsive card grid keeps card identity and workspace keeps editor composition through resizing and unloading',async()=>{
 const grid=new HYNativeCardGrid({minCardWidth:260,maxColumns:3,gap:12}),cards=[new ns.Button(),new ns.Button(),new ns.Button(),new ns.Button()];let width=1180;grid.getActualSize=()=>({width,height:760});grid.setItems(cards);grid.load();await ns.drain();assert.equal(grid.columns,'*,12,*,12,*');assert.equal(cards[3].row,2);
 width=390;grid.notify('layoutChanged');await ns.drain();assert.equal(grid.columns,'*');assert.equal(grid.children[0],cards[0]);assert.equal(cards[3].row,6);grid.unload();
 const workspace=new HYNativeWorkspace(),reference=new ns.ScrollView(),editor=new ns.TextView();editor.text='marked';editor.composing=true;workspace.getActualSize=()=>({width,height:760});workspace.setPanes(reference,editor);workspace.load();await ns.drain();assert.equal(editor.row,1);workspace.toggleReference();assert.equal(reference.visibility,'collapse');width=1180;workspace.notify('layoutChanged');await ns.drain();assert.equal(editor.column,0);workspace.toggleReference();assert.equal(editor.column,2);assert.equal(editor.row,0);assert.equal(workspace.children[1],editor);assert.equal(editor.text,'marked');assert.equal(editor.composing,true);workspace.unload();assert.equal(ns.bindings.size,0);
});
test('portable FormGroup description follows the control without replacing marked text',async()=>{
 const tree=description=>n('FormGroup','group',{label:'Name',description},{children:[n('TextInput','input',{value:'initial'})]});const f=fixture(tree('Help'));await ns.drain();const input=f.view('/group/input');input.composing=true;input.text='ni';input.notify('nativeInput');f.page.render(tree('Updated help'));assert.equal(input.text,'ni');assert.match(input.accessibilityHint,/Updated help/);f.dispose();
});

test('keyboard resizing keeps dialog actions reachable and compact workspace clears the inset before returning',async()=>{
 const owner=new ns.Page();owner.load();const handle=hyShowNativeOverlay(owner,{title:'Form',content:new ns.StackLayout(),theme:p1Theme});const overlay=handle.page.content,card=overlay.children[0];overlay.getActualSize=()=>({width:820,height:760});overlay.notify('layoutChanged');await ns.drain();ns.keyboardCallbacks.get(overlay)(300);await ns.drain();assert.equal(card.maxHeight,428);assert.equal(card.verticalAlignment,'top');handle.close();await handle.closed;
 const workspace=new HYNativeWorkspace();workspace.getActualSize=()=>({width:390,height:760});workspace.setPanes(new ns.ScrollView(),new ns.TextView());workspace.load();ns.keyboardCallbacks.get(workspace)(300);await ns.drain();assert.equal(workspace.paddingBottom,300);workspace.unload();assert.equal(workspace.paddingBottom,0);workspace.load();await ns.drain();assert.equal(workspace.paddingBottom,0);workspace.unload();assert.equal(ns.bindings.size,0);
});
