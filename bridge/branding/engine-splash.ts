import { Color, Device, GridLayout, Image, Label, StackLayout } from '@nativescript/core';

/** Shared native loading overlay. Copy assets/haiyue-moon.png to branding/ in
 * the app bundle, then dismiss only after the first successful GPU presentation. */
export class NativeEngineSplash {
  readonly view = new GridLayout();
  private readonly caption = new Label();
  private state: 'loading' | 'leaving' | 'hidden' | 'failed' | 'disposed' = 'loading';
  private fade?: ReturnType<GridLayout['animate']>;
  private readonly language = Device.language?.startsWith('ja') ? 'ja' : Device.language?.startsWith('zh') ? 'zh' : 'en';

  constructor(private readonly parent: GridLayout) {
    this.view.backgroundColor = new Color('#07111f');
    this.view.iosOverflowSafeArea = true;
    const content = new StackLayout();
    content.horizontalAlignment = 'center';
    content.verticalAlignment = 'middle';
    content.width = 280;
    const logo = new Image();
    logo.loadMode = 'sync';
    logo.src = '~/branding/haiyue-moon.png';
    logo.width = 112;
    logo.height = 112;
    logo.stretch = 'aspectFit';
    logo.accessibilityHidden = true;
    content.addChild(logo);
    const name = new Label();
    name.text = 'HAIYUE ENGINE';
    name.color = new Color('#d9f1ff');
    name.fontSize = 21;
    name.letterSpacing = 0.16;
    name.marginTop = 21;
    name.textAlignment = 'center';
    content.addChild(name);
    const signature = new Label();
    signature.text = 'CRAFTED WITH HAIYUE';
    signature.color = new Color('#7192aa');
    signature.fontSize = 9;
    signature.letterSpacing = 0.22;
    signature.marginTop = 7;
    signature.textAlignment = 'center';
    content.addChild(signature);
    this.caption.text = { zh: '正在载入…', en: 'Loading…', ja: '読み込み中…' }[this.language];
    this.caption.color = new Color('#8daabd');
    this.caption.fontSize = 11;
    this.caption.marginTop = 27;
    this.caption.textAlignment = 'center';
    this.caption.textWrap = true;
    content.addChild(this.caption);
    this.view.addChild(content);
    parent.addChild(this.view);
  }

  presented(): void {
    if (this.state !== 'loading') return;
    this.state = 'leaving';
    // No minimum display timer: fast devices can enter the game immediately.
    this.fade = this.view.animate({ opacity: 0, duration: 180 });
    void this.fade.catch(() => {}).then(() => {
      if (this.state !== 'leaving') return;
      this.state = 'hidden';
      this.view.visibility = 'collapse';
    });
  }

  fail(): void {
    if (this.state === 'disposed') return;
    this.state = 'failed';
    this.fade?.cancel();
    this.view.opacity = 1;
    this.view.visibility = 'visible';
    this.caption.text = { zh: '载入失败，请重新打开游戏', en: 'Unable to load. Please reopen the game.', ja: '読み込めませんでした。再起動してください。' }[this.language];
  }

  dispose(): void {
    this.state = 'disposed';
    this.fade?.cancel();
    this.parent.removeChild(this.view);
  }
}
