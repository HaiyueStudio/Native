import { Button, Color, isIOS, GridLayout, Label, Slider, Switch, TextField, TextView, type View } from '@nativescript/core';
import type { HYTheme } from '@haiyue/ui/core';
export interface HYNativeFormFieldOptions { readonly label:string; readonly description?:string; readonly error?:string; readonly inline?:boolean; }
/** Label/help/error layout for host-owned native controls; updating metadata never rewrites input text. */
export class HYNativeFormField extends GridLayout {
  private focused=false;
  private readonly heading=new Label();private readonly help=new Label();private readonly error=new Label();
  constructor(readonly control:View,private options:HYNativeFormFieldOptions,private readonly theme:HYTheme){
    super();this.heading.textWrap=this.help.textWrap=this.error.textWrap=true;this.heading.iosAccessibilityAdjustsFontSize=this.help.iosAccessibilityAdjustsFontSize=this.error.iosAccessibilityAdjustsFontSize=true;
    control.on('focus',()=>{this.focused=true;this.paintBorder();});control.on('blur',()=>{this.focused=false;this.paintBorder();});
    this.addChild(this.heading);this.addChild(control);this.addChild(this.help);this.addChild(this.error);this.update(options);
  }
  update(options:HYNativeFormFieldOptions):void {
    this.options=options;this.rows=options.inline?'44,auto,auto':'auto,auto,auto,auto';this.columns=options.inline?'*,auto':'*';
    this.heading.text=options.label;this.heading.fontSize=this.theme.fontSize;this.heading.color=new Color(this.theme.color.text);this.heading.verticalAlignment='middle';this.heading.marginBottom=options.inline?0:8;
    GridLayout.setColumn(this.control,options.inline?1:0);GridLayout.setRow(this.control,options.inline?0:1);this.control.verticalAlignment='middle';this.control.minHeight=this.control instanceof Switch?0:44;
    GridLayout.setRow(this.help,options.inline?1:2);GridLayout.setRow(this.error,options.inline?2:3);GridLayout.setColumnSpan(this.help,options.inline?2:1);GridLayout.setColumnSpan(this.error,options.inline?2:1);
    for(const [view,text,color] of [[this.help,options.description,this.theme.color.muted],[this.error,options.error,this.theme.color.danger]] as const){view.text=text??'';view.visibility=text?'visible':'collapse';view.fontSize=this.theme.typography?.caption?.fontSize??12;view.color=new Color(color);view.marginTop=6;}
    this.error.accessibilityLiveRegion='polite';this.control.accessibilityLabel=options.label;this.control.accessibilityHint=[options.description,options.error].filter(Boolean).join('. ');this.marginBottom=20;
    if(this.control instanceof TextField||this.control instanceof TextView){this.control.backgroundColor=new Color(this.theme.color.input);this.control.borderColor=new Color(options.error?this.theme.color.danger:this.theme.color.border);this.control.borderWidth=1;this.control.borderRadius=this.theme.radius;this.control.fontSize=this.theme.fontSize;this.control.color=new Color(this.theme.color.text);}
    if(this.control instanceof Button)this.control.accessibilityValue=this.control.text;
    if(this.control instanceof Slider)this.control.color=new Color(this.theme.color.accent);
    this.paintBorder();
    if(this.control instanceof Switch&&!isIOS){this.control.color=new Color(this.theme.color.onAccent??'#ffffff');this.control.backgroundColor=new Color(this.theme.color.accent);this.control.offBackgroundColor=new Color(this.theme.color.border);}
  }
  private paintBorder():void{if(this.control instanceof TextField||this.control instanceof TextView)this.control.borderColor=new Color(this.options.error?this.theme.color.danger:this.focused?this.theme.color.focus:this.theme.color.border);}
}
