import { GridLayout, isIOS, type View } from '@nativescript/core';
import { hyResponsiveGrid, hyResponsiveWorkspace, type HYResponsiveGridOptions, type HYResponsiveWorkspaceOptions } from '@haiyue/ui/portable';
import { observeKeyboard } from './platform';
/** Reflows existing card instances; no resize listener or timer survives unload. */
export class HYNativeCardGrid extends GridLayout {
  private items:readonly View[]=[];private columnCount=0;private timer?:ReturnType<typeof setTimeout>;
  constructor(private readonly options:HYResponsiveGridOptions={}){super();this.width='100%';this.maxWidth=1320;this.horizontalAlignment='center';this.on('layoutChanged',()=>this.schedule());this.on('loaded',()=>this.schedule());this.on('unloaded',()=>{if(this.timer!==undefined)clearTimeout(this.timer);this.timer=undefined;});}
  setItems(items:readonly View[]):void {for(const item of this.items)if(item.parent===this)this.removeChild(item);this.items=items;for(const item of items)this.addChild(item);this.columnCount=0;this.arrange();}
  private schedule():void{if(this.timer!==undefined)return;this.timer=setTimeout(()=>{this.timer=undefined;if(this.isLoaded)this.arrange();},0);}
  private arrange():void{const layout=hyResponsiveGrid(Math.max(0,this.getActualSize().width),this.options);if(layout.columns===this.columnCount)return;this.columnCount=layout.columns;const tracks=(count:number,size:string)=>Array.from({length:count},()=>size).join(`,${layout.gap},`);this.columnCount=layout.columns;this.columns=tracks(layout.columns,'*');this.rows=tracks(Math.ceil(this.items.length/layout.columns),'auto');this.items.forEach((item,index)=>{GridLayout.setColumn(item,index%layout.columns*2);GridLayout.setRow(item,Math.floor(index/layout.columns)*2);});}
}
/** Keeps both panes mounted across rotation, split-view and keyboard changes. */
export class HYNativeWorkspace extends GridLayout {
  private timer?:ReturnType<typeof setTimeout>;private keyboardOff?:(()=>void);private keyboardHeight=0;private referenceVisible=true;private referencePane?:View;private editorPane?:View;
  constructor(private readonly options:HYResponsiveWorkspaceOptions={}){super();this.on('layoutChanged',()=>this.schedule());this.on('loaded',()=>{this.keyboardOff?.();this.keyboardOff=observeKeyboard(this,height=>{if(isIOS){this.keyboardHeight=height;this.paddingBottom=height;this.schedule();}});this.schedule();});this.on('unloaded',()=>{this.keyboardOff?.();this.keyboardOff=undefined;this.keyboardHeight=0;this.paddingBottom=0;if(this.timer!==undefined)clearTimeout(this.timer);this.timer=undefined;});}
  setPanes(reference:View,editor:View):void{if(this.referencePane||this.editorPane)throw Error('Workspace panes are already mounted');this.referencePane=reference;this.editorPane=editor;this.addChild(reference);this.addChild(editor);this.arrange();}
  toggleReference():void{this.referenceVisible=!this.referenceVisible;this.arrange();}
  private schedule():void{if(this.timer!==undefined)return;this.timer=setTimeout(()=>{this.timer=undefined;if(this.isLoaded)this.arrange();},0);}
  private arrange():void{if(!this.referencePane||!this.editorPane)return;const size=this.getActualSize(),layout=hyResponsiveWorkspace(Math.max(0,size.width),Math.max(0,size.height-this.keyboardHeight),this.options);const split=layout.split&&this.referenceVisible,shown=this.referenceVisible&&(this.keyboardHeight===0||layout.split);this.columns=split?`42*,${layout.gap},58*`:'*';this.rows=layout.split?'*':`${shown?layout.referenceHeight:0},*`;GridLayout.setColumn(this.editorPane,split?2:0);GridLayout.setRow(this.editorPane,layout.split?0:1);this.referencePane.visibility=shown?'visible':'collapse';}
}
