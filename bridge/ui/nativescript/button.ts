import { Button, Color, isIOS } from '@nativescript/core';
import { hyValidateProps } from '@haiyue/ui/core';
import type { HYComponentProps, HYTheme } from '@haiyue/ui/core';
import { buttonAdornment } from './platform';
export type HYNativeButtonProps = HYComponentProps['Button'];
/** Public native Button for host-owned toolbars, using the portable presentation contract. */
export class HYNativeButton extends Button {
  private presentation: HYNativeButtonProps;
  private theme: HYTheme;
  private release?: () => void;
  private active = true;
  private pressed = false;
  constructor(props: HYNativeButtonProps, theme: HYTheme, private readonly manageAccessibility = true) {
    super();this.presentation=props;this.theme=theme;
    this.on('loaded',()=>this.paint());this.on('unloaded',()=>this.clear());
    this.on('touch',(event:any)=>{this.pressed=event.action==='down';this.paintSurface();});
    this.setPresentation(props,theme);
  }
  setPresentation(props: HYNativeButtonProps, theme: HYTheme = this.theme): void {
    if(this.manageAccessibility)hyValidateProps('Button',props);
    this.presentation=props;this.theme=theme;this.text=props.text;
    this.isEnabled=!props.disabled&&!props.busy;
    if(this.manageAccessibility){this.accessibilityLabel=props.a11y?.label ?? props.text;this.accessibilityRole='button';this.accessibilityState=this.isEnabled?undefined:'disabled';}
    this.paint();
  }
  setPresentationActive(active:boolean): void { this.active=active;this.pressed=false;this.paint(); }
  /** Called after inherited renderer styling / environment changes. */
  refreshPresentation(theme:HYTheme=this.theme): void {this.theme=theme;this.paint();}
  private clear():void {this.release?.();this.release=undefined;}
  private paintSurface():void {
    const p=this.presentation,t=this.theme,v=p.variant??'secondary';
    const filled=v==='primary'||v==='danger';
    this.backgroundColor=new Color(this.pressed&&this.isEnabled?(t.color.pressed??t.color.selected??t.color.accent):v==='primary'?t.color.accent:v==='danger'?t.color.danger:v==='quiet'?'transparent':t.color.surface);
    this.borderWidth=v==='secondary'?1:0;this.borderColor=new Color(t.color.border);this.borderRadius=t.radius;
    this.color=new Color(filled?(t.color.onAccent??'#ffffff'):t.color.text);this.opacity=p.disabled ? .45 : p.busy ? .75 : 1;
    this.minHeight=Math.max(44,p.layout?.minHeight??0);this.minWidth=p.icon&&!p.text?44:p.layout?.minWidth??44;
    this.paddingLeft=this.paddingRight=p.icon&&!p.text?0:p.size==='compact'?8:14;this.paddingTop=this.paddingBottom=0;
    this.margin=0;this.textTransform='none';this.fontSize=t.fontSize;this.lineHeight=isIOS&&(this.whiteSpace==='initial'||this.whiteSpace==='nowrap'||this.whiteSpace===undefined)?0:t.lineHeight-t.fontSize;
  }
  private paint():void {
    this.paintSurface();this.clear();
    if(this.isLoaded&&this.active){const t=this.theme,v=this.presentation.variant;this.release=buttonAdornment(this,this.presentation.icon,!!this.presentation.busy,v==='primary'||v==='danger'?(t.color.onAccent??'#ffffff'):t.color.text);}
  }
}
