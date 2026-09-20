import { Color, Device, GridLayout, Image, Label, StackLayout } from '@nativescript/core';

export interface NativeEngineSplashOptions {
  orientation?: 'auto' | 'portrait' | 'landscape';
  /** Optional app-specific initialization status, localized by the caller. */
  message?: string;
}

/** DIP sizing shared by the overlay and launch page. No platform orientation lock. */
export function engineSplashLayout(width: number, height: number, orientation: NativeEngineSplashOptions['orientation'] = 'auto') {
  const portrait = orientation === 'portrait' || (orientation === 'auto' && height >= width);
  const contentWidth = Math.max(160, Math.min(portrait ? 320 : 280, width - 40));
  const logo = Math.max(64, Math.min(portrait ? 152 : 112, contentWidth * .48, height * .28));
  return { contentWidth, logo, title: contentWidth < 240 ? 18 : portrait ? 23 : 21,
    gap: Math.min(portrait ? 28 : 21, height * .055), captionGap: Math.min(portrait ? 34 : 27, height * .06),
    offset: portrait ? -Math.min(28, height * .03) : 0 };
}

/** Shared native loading overlay. Copy assets/haiyue-moon.png to branding/ in
 * the app bundle, then dismiss only after the first successful GPU presentation. */
export class NativeEngineSplash {
  readonly view = new GridLayout();
  private readonly content = new StackLayout();
  private readonly logo = new Image();
  private readonly name = new Label();
  private readonly caption = new Label();
  private state: 'loading' | 'leaving' | 'hidden' | 'failed' | 'disposed' = 'loading';
  private fade?: ReturnType<GridLayout['animate']>;
  private readonly language = Device.language?.startsWith('ja') ? 'ja' : Device.language?.startsWith('zh') ? 'zh' : 'en';

  constructor(private readonly parent: GridLayout, private readonly options: NativeEngineSplashOptions = {}) {
    this.view.backgroundColor = new Color('#07111f');
    this.view.iosOverflowSafeArea = true;
    this.view.isUserInteractionEnabled = true;
    const content = this.content;
    content.horizontalAlignment = 'center';
    content.verticalAlignment = 'middle';
    content.width = 280;
    const logo = this.logo;
    logo.loadMode = 'sync';
    logo.src = '~/branding/haiyue-moon.png';
    logo.width = 112;
    logo.height = 112;
    logo.stretch = 'aspectFit';
    logo.accessibilityHidden = true;
    content.addChild(logo);
    const name = this.name;
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
    this.caption.text = options.message ?? { zh: '正在载入…', en: 'Loading…', ja: '読み込み中…' }[this.language];
    this.caption.color = new Color('#8daabd');
    this.caption.fontSize = 11;
    this.caption.marginTop = 27;
    this.caption.textAlignment = 'center';
    this.caption.textWrap = true;
    content.addChild(this.caption);
    this.view.addChild(content);
    parent.addChild(this.view);
    parent.on('layoutChanged', this.layout);
    this.layout();
  }

  private readonly layout = (): void => {
    const { width, height } = this.parent.getActualSize();
    if (!width || !height || this.state === 'disposed') return;
    const l = engineSplashLayout(width, height, this.options.orientation ?? 'auto');
    this.content.width = l.contentWidth;
    this.content.translateY = l.offset;
    this.logo.width = this.logo.height = l.logo;
    this.name.fontSize = l.title;
    this.name.marginTop = l.gap;
    this.caption.marginTop = l.captionGap;
  };

  get status(): 'loading' | 'leaving' | 'hidden' | 'failed' | 'disposed' { return this.state; }

  setMessage(message: string): void {
    if (this.state === 'loading') this.caption.text = message;
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

  fail(message?: string): void {
    if (this.state === 'disposed') return;
    this.state = 'failed';
    this.fade?.cancel();
    this.view.opacity = 1;
    this.view.visibility = 'visible';
    this.caption.text = message ?? { zh: '载入失败，请重新打开游戏', en: 'Unable to load. Please reopen the game.', ja: '読み込めませんでした。再起動してください。' }[this.language];
  }

  dispose(): void {
    if (this.state === 'disposed') return;
    this.state = 'disposed';
    this.fade?.cancel();
    this.parent.off('layoutChanged', this.layout);
    this.parent.removeChild(this.view);
  }
}
