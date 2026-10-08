import {Application,Button,StackLayout,ScrollView,Label,File,knownFolders,isIOS} from '@nativescript/core';
import {scanCode,cancelScan} from '@haiyue/native/scanner';
import {shareContent,canShareContent} from '@haiyue/native/share';
import {createRewards} from '@haiyue/native/rewards/native';
const file=File.fromPath(knownFolders.documents().path+'/native-validation.jsonl');
let lines='',status:Label;
function log(event:string,data:unknown={}){const row={time:new Date().toISOString(),platform:isIOS?'ios':'android',event,data};lines+=JSON.stringify(row)+'\n';file.writeTextSync(lines);console.log('NATIVE_VALIDATION '+JSON.stringify(row));if(status)status.text=lines.slice(-3500);}
let reward:ReturnType<typeof createRewards>|undefined;
function rewards(){return reward??=createRewards({storageNamespace:'native-013-validation',rewardAmount:3,dailyFree:5,dailyAds:100,iosUnit:'ca-app-pub-3940256099942544/1712485313',androidUnit:'ca-app-pub-3940256099942544/5224354917',onFailure:f=>log('reward-failure',f)},{entitled:()=>false,pause:()=>()=>{}});}
async function scan(maxTextLength=8192,autoCancel=false){log('scan-start',{maxTextLength,autoCancel});try{const p=scanCode({prompt:'Native 0.1.3 camera test',cancelLabel:'Cancel test',maxTextLength});if(autoCancel){setTimeout(()=>{log('scan-cancel-request');cancelScan();},4000);try{await scanCode();log('FAIL-concurrent');}catch(e){log('concurrent-rejected',String(e));}}const value=await p;log(value?'scan-result':'scan-cancelled',value?{text:value.text,length:value.text.length}:{});}catch(e){log('scan-error',String(e));}}
async function share(withImage=false){
 const content={title:'Native share test',text:'Demo score: 100 points',url:'https://example.com/challenge',...(withImage?{image:{bytes:new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,4,0,0,0,181,28,12,2,0,0,0,11,73,68,65,84,120,218,99,252,255,31,0,3,3,2,0,239,162,167,91,0,0,0,0,73,69,78,68,174,66,96,130]),mimeType:'image/png' as const,filename:'test-result.png'}}:{})};
 log('share-start',{withImage,available:canShareContent(content)});try{log('share-result',await shareContent(content));}catch(error){log('share-error',String(error));}
}
Application.run({create:()=>{const page=new StackLayout();page.padding='48 16 20 16';page.backgroundColor='#edf5ff';
 const title=new Label();title.text='Native 0.1.3 validation';title.fontSize=24;page.addChild(title);
 const add=(text:string,fn:()=>void)=>{const b=new Button();b.text=text;b.height=50;b.on('tap',fn);page.addChild(b);};
 add('Share text',()=>void share());add('Share image',()=>void share(true));
 add('Scan QR',()=>void scan());add('Cancel + concurrency (4s)',()=>void scan(8192,true));add('Reject > 8 characters',()=>void scan(8));
 add('Test rewarded ad (+3)',()=>{log('reward-before',rewards().snapshot());void rewards().watch().then(()=>log('reward-after',rewards().snapshot())).catch(e=>log('reward-exception',String(e)));});
 add('Test dispose while loading',()=>{log('dispose-start');void rewards().watch().then(()=>log('dispose-settled',rewards().snapshot()));setTimeout(()=>rewards().dispose(),100);});
 status=new Label();status.textWrap=true;status.fontSize=11;page.addChild(status);const scroll=new ScrollView();scroll.content=page;log('ready');return scroll;}});
