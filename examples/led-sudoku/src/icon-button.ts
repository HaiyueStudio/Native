import { THEMES, type ThemeId } from '../../../../Games/games/led-sudoku/theme';
import { Button, Color, GridLayout, Image } from '@nativescript/core';
export class IconButton extends GridLayout {
  readonly hit = new Button();
  private readonly icon = new Image();
  constructor(name: string, action: () => void, private readonly compact = false) {
    super(); this.id = name; this.width = this.height = 48; this.margin = 2; this.horizontalAlignment = 'center'; this.verticalAlignment = 'middle';
    this.borderWidth = 1; this.borderRadius = 9; this.borderColor = new Color('#29464e'); this.backgroundColor = new Color('#10262e');
    this.icon.src = `~/icons/${name}.png`; this.icon.width = this.icon.height = 24; this.icon.stretch = 'aspectFit'; this.icon.horizontalAlignment='center'; this.icon.verticalAlignment='middle'; this.icon.accessibilityHidden=true; this.icon.isUserInteractionEnabled=false;
    this.addChild(this.icon); this.hit.text=''; this.hit.className='icon-hit'; this.hit.on('tap',action); this.addChild(this.hit);
    if(compact){this.width=this.height=44;this.margin=0;this.borderWidth=0;this.icon.width=this.icon.height=18;}
  }
  setLabel(value: string): void { this.hit.accessibilityLabel=value; }
  setEnabled(value: boolean): void { this.hit.isEnabled=value; this.opacity=value?1:.28; }
  private theme: ThemeId = 'dark';
  private active = false;
  setTheme(theme: ThemeId): void { this.theme=theme;this.setActive(this.active); }
  setActive(value: boolean): void { this.active=value;const c=THEMES[this.theme];this.borderColor=new Color(value?c.accent:c.border);this.backgroundColor=new Color(this.compact?'transparent':value?c.active:c.panel);this.icon.tintColor=new Color(value?c.accent:c.text); }
}
