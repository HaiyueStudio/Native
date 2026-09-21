import { Button, Color, StackLayout } from '@nativescript/core';
/** Compact dropdown shared by both Native platforms (not an always-visible wheel). */
export class SelectionDropdown extends StackLayout {
  readonly trigger = new Button();
  readonly options = new StackLayout();
  private selected = 0;
  constructor(private items: readonly string[], private readonly changed: (index: number) => void) {
    super(); this.trigger.height=48; this.trigger.textAlignment='left'; this.trigger.paddingLeft=14;
    this.options.visibility='collapse'; this.options.className='dropdown-options';
    items.forEach((name,index)=> { const b=new Button(); b.text=name; b.height=44; b.textAlignment='left'; b.paddingLeft=14; b.on('tap',()=>{this.setSelected(index);this.options.visibility='collapse';this.changed(index);}); this.options.addChild(b); });
    this.trigger.on('tap',()=>this.options.visibility=this.options.visibility==='visible'?'collapse':'visible');
    this.addChild(this.trigger);this.addChild(this.options);this.setSelected(0);
  }
  setItems(items:readonly string[]):void { this.items=items;items.forEach((name,i)=>(this.options.getChildAt(i) as Button).text=name);this.setSelected(this.selected); }
  setSelected(index: number): void { this.selected=index;this.trigger.text=`${this.items[index]}  ▾`; }
  setLabel(value: string): void { this.trigger.accessibilityLabel=`${value}: ${this.items[this.selected]}`; }
}
