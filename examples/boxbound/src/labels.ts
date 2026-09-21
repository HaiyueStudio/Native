import {AbsoluteLayout,Label,Color} from '@nativescript/core';
import type {BoxboundLabels,BoxboundLabel} from '../../../../Games/games/boxbound/labels';
export class NativeLabels implements BoxboundLabels {
  constructor(readonly root:AbsoluteLayout){}
  get count(){return this.root.getChildrenCount();}
  create():BoxboundLabel{const label=new Label();label.fontSize=9;label.color=new Color('#34564c');label.backgroundColor=new Color(232,255,247,230);label.padding='2 5';label.borderRadius=4;label.isUserInteractionEnabled=false;this.root.addChild(label);
    return{text(text,complete){label.text=text;label.color=new Color(complete?'#168768':'#34564c');},project(x,y,visible){label.visibility=visible?'visible':'hidden';AbsoluteLayout.setLeft(label,Math.max(0,x-label.getActualSize().width/2));AbsoluteLayout.setTop(label,Math.max(0,y-10));},remove:()=>this.root.removeChild(label)};
  }
  opacity(value:number){this.root.opacity=value;}
  clear(){this.root.removeChildren();}
}
