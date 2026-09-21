import { THEMES } from '../../../../Games/games/led-sudoku/theme';
import { lessonText } from '../../../../Games/games/led-sudoku/hint-explanation';
import { Application, Button, Color, GridLayout, Label, Page, Screen, ScrollView, StackLayout, View, alert, confirm, isAndroid, type EventData } from '@nativescript/core';
import { Canvas } from '@nativescript/canvas';
import { LocalStorageSaveBackend } from '@haiyue/engine/save';
import { SingleSlotGameSave } from '../../../../Games/games/save/SingleSlotGameSave';
import { DEFAULT_OPTIONS, SEGMENTS, candidates, cellRuleDetails, lineRuleDescription, isSaveData, type Options, type SaveData } from '../../../../Games/games/led-sudoku/rules';
import { editable } from '../../../../Games/games/led-sudoku/session';
import { NativeRenderHost } from '../../../bridge/lifecycle/host';
import { nativeLaunchFlag } from '../../../bridge/lifecycle/launch-flags';
import { NativeSettingsStorage } from '../../../bridge/storage/settings-storage';
import { NativeTouchInput } from '../../../bridge/input/native-touch';
import type { NativeCanvasInput } from '../../../bridge/render/surface';
import { boardCellAt } from '../../../../Games/games/led-sudoku/board-painter';
import { BoardScene } from './board-scene';
import { MobileSession } from './model';
import { NativeGenerator, type GeneratorWorker } from './generator';
import { portraitLayout } from './layout';
import { LedDigit } from './led';
import { RULES, showSettings, showPreferences } from './settings';
import { IconButton } from './icon-button';
import { HintLessonPanel } from './hint-lesson';
import { readPreferences, writePreferences } from './preferences';
import { autoCandidateFiltering, preferences, noteDisplayMasks, noteCrossedMasks, type Preferences } from '../../../../Games/games/led-sudoku/preferences';
import { activeRuleDetails, t, type TextKey } from '../../../../Games/games/led-sudoku/i18n';
import { isDevelopmentBuild } from './development';
import { captureDiagnostics } from './diagnostics';
import { runSmoke } from './smoke';
import type { NativeEngineLaunchPage } from '../../../bridge/branding/launch-page';
import { captureNativeView } from '../../../bridge/render/view-capture';

const C = { text: '#d6e9ea', muted: '#8ba6ae', mint: '#83ffc1', cyan: '#75e4ef', line: '#355760' };
function label(text: string, size = 12, color = C.text): Label { const l = new Label(); l.text = text; l.fontSize = size; l.color = new Color(color); l.verticalAlignment = 'middle'; return l; }
function button(text: string, action: () => void, name = ''): Button { const b = new Button(); b.text = text; b.id = name; b.accessibilityIdentifier=name; b.accessibilityLabel = text; b.on('tap', action); return b; }
let active: MobileGame | null = null;
export function onLoaded(e: EventData): void { const page = e.object as Page; if (active?.page === page) return; active?.dispose(); active = new MobileGame(page); }
export function onUnloaded(e: EventData): void { if (active?.page !== e.object || active.modal) return; if (!Application.inBackground && !Application.suspended) { active.dispose(); active = null; } }

export class MobileGame {
  private get colors() { return THEMES[this.preferences?.theme ?? 'dark']; }
  readonly session = new MobileSession();
  readonly canvas = new Canvas();
  readonly content = new GridLayout();
  readonly boardFrame = new GridLayout();
  readonly keys: { tile: GridLayout; digit: LedDigit; plain: Label; strike: StackLayout; hit: Button }[] = [];
  readonly timerView = new StackLayout();
  readonly status = label('正在启动原生引擎…', 11, this.colors.muted);
  readonly cell = label('请选择一个格子', 11, this.colors.cyan);
  readonly mode = label('LED · 标准', 10, this.colors.cyan);
  readonly progress = label('', 10, this.colors.muted);
  readonly busy = label('正在启动原生引擎…', 14, this.colors.accent);
  readonly generator = new NativeGenerator(() => new Worker('./generator.worker') as unknown as GeneratorWorker);
  readonly save: SingleSlotGameSave<SaveData>;
  host: NativeRenderHost | null = null;
  scene: BoardScene | null = null;
  input: NativeTouchInput | null = null;
  modal = false;
  loading = false;
  disposed = false;
  paused = false;
  private readonly root: GridLayout;
  private readonly scroll = new ScrollView();
  private readonly notes: IconButton;
  private readonly undoButton: IconButton;
  private readonly erase: IconButton;
  private readonly hint: IconButton;
  private readonly explain: IconButton;
  private readonly newButton: Button;
  private readonly gear: IconButton;
  private readonly helpButton: Button;
  private readonly answerButton: Button;
  private readonly titleLabel = label('', 23);
  readonly toolButtons: IconButton[] = [];
  readonly lessonPanel: HintLessonPanel;
  private lessonIndex = -1;
  preferences = readPreferences();
  private generationFailed = false;
  private tr(key: TextKey, values: Record<string,string|number> = {}): string { return t(this.preferences.language,key,values); }
  private clockDigits: LedDigit[] = [];
  private clockLength = 0;
  private interval: ReturnType<typeof setInterval>;
  private pulse: ReturnType<typeof setInterval> | undefined;
  private lastTick = Date.now();
  private wasComplete = false;
  private revision = 0;
  private firstPresentation = false;
  private down: { id: number; x: number; y: number } | null = null;
  private readonly smoke: boolean;
  private readonly uiTest: boolean;
  private readonly diagnosticCapture: boolean;
  private captureSplash: boolean;
  private readonly splash: NativeEngineLaunchPage['splash'];
  private readonly activity: unknown;
  constructor(readonly page: Page) {
    this.splash = (page as NativeEngineLaunchPage).splash;
    this.root = page.getViewById<GridLayout>('appRoot');
    this.root.backgroundColor = new Color('#061015');
    this.activity = page._context;
    const dev = isDevelopmentBuild();
    this.uiTest = dev && nativeLaunchFlag('LED_UI_TEST');
    this.smoke = this.uiTest || (dev && nativeLaunchFlag('LED_SMOKE'));
    this.diagnosticCapture = dev && nativeLaunchFlag('LED_CAPTURE');
    this.captureSplash = this.smoke || this.diagnosticCapture;
    if (this.smoke) this.preferences = preferences({language:'zh'});
    this.session.filterCandidates = autoCandidateFiltering(this.preferences);
    this.busy.text = this.tr('loading');
    this.save = new SingleSlotGameSave({ gameId: 'led-sudoku', name: '流光数独自动存档', validateData: isSaveData, backend: new LocalStorageSaveBackend({ namespace: this.smoke ? 'led-native-smoke' : 'haiyue-games', storage: new NativeSettingsStorage() }), onStatus: s => { if (s === 'error') void alert({ title:this.tr('saveError'), okButtonText:this.tr('okay') }); } });
    this.content.rows = portraitLayout(360, 800).rows; this.content.padding = '0 10';
    this.scroll.content = this.content; this.root.addChild(this.scroll);
    const head = new GridLayout(); head.columns = '*,auto'; this.titleLabel.fontWeight = 'bold'; head.addChild(this.titleLabel);
    this.timerView.orientation = 'horizontal'; this.timerView.verticalAlignment = 'middle'; GridLayout.setColumn(this.timerView, 1); head.addChild(this.timerView); this.add(head, 0);
    const meta = new GridLayout(); meta.columns = '*,auto'; this.mode.textWrap = false; meta.addChild(this.mode); GridLayout.setColumn(this.progress, 1); meta.addChild(this.progress); this.add(meta, 1);
    this.boardFrame.borderWidth = 1; this.boardFrame.borderRadius = 5; this.boardFrame.borderColor = new Color(this.colors.line); this.boardFrame.padding = 3; this.boardFrame.horizontalAlignment = 'center';
    this.canvas.id = 'board'; this.canvas.ignoreTouchEvents = true; this.canvas.on('ready', () => this.attach()); this.boardFrame.addChild(this.canvas);
    this.busy.accessibilityIdentifier='generation-status';this.busy.textAlignment = 'center'; this.busy.textWrap = true; this.busy.backgroundColor = new Color(238,6,16,21); this.boardFrame.addChild(this.busy); this.add(this.boardFrame, 2);
    const tools = new GridLayout(); tools.columns = '*,*,*,*,*,*';
    this.notes = new IconButton('notes', () => { this.session.pencil = !this.session.pencil; this.render(); });
    this.undoButton = new IconButton('undo', () => { if (this.session.undo()) this.commit(this.tr('undo')); });
    this.erase = new IconButton('erase', () => this.enter(0));
    this.hint = new IconButton('hint', () => { const text=this.session.explain(this.preferences.language);this.render();if(this.session.hint)this.message(text);if(!this.session.hint)void this.showText(this.tr('hint'),text); });
    this.explain = new IconButton('explain', () => this.openExplanation());
    this.gear = new IconButton('settings', () => void this.openPreferences());
    this.toolButtons.push(this.notes,this.undoButton,this.erase,this.hint,this.explain,this.gear);
    this.toolButtons.forEach((b,i)=>{GridLayout.setColumn(b,i);tools.addChild(b);});this.add(tools,3);
    this.add(this.cell, 4);
    const keypad = new GridLayout(); keypad.rows = '*,*,*'; keypad.columns = '*,*,*';
    for (let d = 1; d <= 9; d++) {
      const tile = new GridLayout(); tile.className = 'key-tile'; const digit = new LedDigit(.85); digit.view.horizontalAlignment = 'center'; digit.view.verticalAlignment = 'middle'; tile.addChild(digit.view);
      const plain = label(String(d), 28, this.colors.accent); plain.textAlignment = 'center'; tile.addChild(plain);
      const strike = new StackLayout(); strike.width=32; strike.height=2; strike.rotate=-40; strike.horizontalAlignment='center'; strike.verticalAlignment='middle'; strike.backgroundColor=new Color('#dc9aa7'); strike.isUserInteractionEnabled=false; tile.addChild(strike);
      const hit = button(`填入 ${d}`, () => this.enter(d), `digit-${d}`); hit.className = 'key-hit'; tile.addChild(hit);
      GridLayout.setRow(tile, Math.floor((d - 1) / 3)); GridLayout.setColumn(tile, (d - 1) % 3); keypad.addChild(tile); this.keys.push({ tile, digit, plain, strike, hit });
    }
    this.add(keypad, 5);
    // Transient diagnostics stay out of the playing surface; explanations use their own panel.
    const footer = new GridLayout(); footer.columns = '2*,*,*';
    this.newButton = button('＋ 新数独', () => void this.settings(), 'new'); this.newButton.className = 'primary'; footer.addChild(this.newButton);
    this.helpButton = button('', () => void this.help(), 'help'); GridLayout.setColumn(this.helpButton, 1); footer.addChild(this.helpButton);
    this.answerButton = button('', () => void this.more(), 'more'); GridLayout.setColumn(this.answerButton, 2); footer.addChild(this.answerButton); this.add(footer, 8);
    this.lessonPanel=new HintLessonPanel(delta=>this.moveExplanation(delta),()=>this.closeExplanation());GridLayout.setRowSpan(this.lessonPanel,6);this.add(this.lessonPanel,3);
    this.root.on('layoutChanged', this.layout); Application.on(Application.exitEvent, this.exit); Application.on(Application.uncaughtErrorEvent, this.error);
    this.applyTheme(); this.localize(); this.layout(); this.updateClock();
    this.interval = setInterval(() => { this.tick(); this.updateClock(); }, 1000);
  }
  private add(view: View, row: number): void { GridLayout.setRow(view, row); this.content.addChild(view); }
  readonly layout = (): void => {
    const size = this.root.getActualSize(); if (!size.width || !size.height) return;
    // iOS root is already confined to UIKit safe area; only add content spacing.
    let top = isAndroid ? 24 : 8, bottom = isAndroid ? 16 : 8;
    if (isAndroid && android.os.Build.VERSION.SDK_INT >= 28) {
      const insets = this.root.nativeViewProtected?.getRootWindowInsets(); const cutout = insets?.getDisplayCutout();
      top = Math.max(top, (cutout?.getSafeInsetTop() ?? 0) / Screen.mainScreen.scale + 8);
      bottom = Math.max(bottom, (cutout?.getSafeInsetBottom() ?? 0) / Screen.mainScreen.scale + 8);
    }
    const l = portraitLayout(size.width, size.height, top, bottom);
    this.root.paddingTop = top; this.root.paddingBottom = bottom;
    this.content.height = l.contentHeight; this.content.rows = l.rows; this.boardFrame.width = l.board; this.boardFrame.height = l.board;
    this.toolButtons.forEach(b=>{b.width=b.height=l.toolSize;});
  };
  private attach(): void {
    if (this.host || this.disposed) return;
    this.input = new NativeTouchInput(this.canvas, sample => {
      const point = sample.points[0];
      if (sample.action === 'down' && point && sample.input.primary === point.id) this.down = { id: point.id, x: point.x, y: point.y };
      else if (sample.action === 'up' && point && this.down?.id === point.id) {
        const start = this.down; this.down = null;
        if (!this.loading && !this.modal && Math.hypot(start.x - point.x, start.y - point.y) < 12) {
          const rect = this.input!.target.getBoundingClientRect(); const cell = this.session.state ? boardCellAt(this.session.state.puzzle, point.x / rect.width, point.y / rect.height) : -1;
          if (cell >= 0) { this.session.select(cell); this.render(); this.message(this.details().join(' ') || '选择下方候选数字填入，或开启笔记。'); }
        }
      } else if (['cancel', 'suspend', 'dispose', 'unloaded'].includes(sample.action)) this.down = null;
    });
    const target = this.input.target;
    this.host = new NativeRenderHost(this.canvas, text => {
      if (text.startsWith('原生 WebGPU 已呈现')) {
        if (this.captureSplash) {
          this.captureSplash = false;
          try { captureNativeView(this.splash.view, 'led-sudoku-engine-splash.png'); }
          catch (e) { console.error('Splash capture failed', e); }
        }
        this.splash.presented();
        this.firstPresentation = true; if (!this.loading) this.busy.visibility = 'collapse';
      }
      else if (text.startsWith('初始化或渲染失败')) { this.splash.fail(this.tr('loadError')); this.busy.visibility = 'visible'; this.busy.text = this.tr('loadError'); this.message(text); }
    }, {
      diagnosticName: 'led-sudoku', capture: { requested: this.smoke || this.diagnosticCapture, file: 'led-sudoku-board.png' }, diagnosticIntervalFrames: 0, needsAnimationFrame: () => this.scene?.animating ?? false,
      canvasInput: { addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target), setPointerCapture: target.setPointerCapture.bind(target), releasePointerCapture: target.releasePointerCapture.bind(target) } as unknown as NativeCanvasInput,
      engineOptions: { msaaSamples: 4, clearColor: { r: .02, g: .045, b: .065, a: 1 } },
      prepareScene: async engine => {
        this.scene = new BoardScene(engine);
        const saved = this.smoke ? null : await this.save.load();
        if (this.disposed) return;
        if (saved) { this.session.restore(saved); this.render(); this.message('已恢复上次棋局 · 进度自动保存'); }
        else await this.newGame(DEFAULT_OPTIONS, this.smoke ? 20260920 : undefined);
        return { rules: this.session.state?.puzzle.options, seed: this.session.state?.puzzle.seed };
      },
      bindInput: (_engine, report) => {
        if (this.smoke && !this.uiTest) setTimeout(() => { if (!this.disposed) void runSmoke(this, report).then(() => setTimeout(() => { if (!this.disposed) { try { report('screen-capture', captureDiagnostics(this.page)); } catch (e) { report('screen-capture-error', String(e)); } } }, 500)); }, 1000);
        if (this.diagnosticCapture && !this.smoke) setTimeout(() => {
          if (this.disposed) return;
          report('settled-layout', this.snapshot());
          try { report('screen-capture', captureDiagnostics(this.page)); }
          catch (e) { report('screen-capture-error', String(e)); }
        }, 2000);
        return { suspend: () => { this.tick(); this.paused = true; this.input?.suspend(); this.stopPulse(); this.scene?.cancelSweep(); void this.flush(); }, resume: () => { this.paused = false; this.lastTick = Date.now(); this.input?.resume(); this.render(); }, dispose: () => this.input?.dispose(), snapshot: () => ({ input: this.input?.snapshot(), game: this.snapshot() }) };
      },
      disposeScene: () => { this.scene?.dispose(); this.scene = null; this.input?.dispose(); },
    });
  }
  async newGame(options: Options, seed = Date.now() >>> 0): Promise<void> {
    this.closeExplanation();
    const revision = ++this.revision; this.loading = true; this.generationFailed=false;this.busy.text = this.tr(options.difficulty === 'hard' ? 'generatingHard' : 'generating'); this.busy.visibility = 'visible'; this.message('正在生成新数独…'); this.render();
    try {
      const g = await this.generator.generate(options, seed); if (!g || this.disposed || revision !== this.revision) return;
      this.session.start(g); this.lastTick = Date.now(); this.loading = false; this.commit(options.led !== false ? '新数独已就绪 · 全暗灯管格也可填数' : '新数独已就绪 · 选择空格开始填写');
    } catch (e) { console.error(e);this.generationFailed=true;this.busy.text=this.tr('generationError'); }
    finally { if (!this.disposed && revision === this.revision) { this.loading = false; this.render(); if (!this.generationFailed && this.session.state && this.firstPresentation) this.busy.visibility = 'collapse'; } }
  }
  enter(d: number): void {
    if (this.loading || this.paused || this.modal || !this.session.input(d)) return;
    const s = this.session.state!;
    this.commit(this.session.done ? s.assisted ? '棋局完成 · 使用过答案辅助' : '恭喜完成！' : this.session.pencil && d ? '候选笔记已更新' : d && s.board[this.session.selected] !== s.solution[this.session.selected] ? '该数字与答案不符，可擦除或撤销。' : '进度已保存');
  }
  commit(text: string): void { this.render(); this.message(text); if (this.session.state) this.save.save(structuredClone(this.session.state)); }
  message(text: string): void { if (!this.disposed) this.status.text = text; }
  details(): string[] { return this.session.state ? cellRuleDetails(this.session.state.puzzle, this.session.selected, this.preferences.language) : []; }
  render(): void {
    if (this.disposed) return;
    const s = this.session.state;
    this.newButton.isEnabled = !this.loading;
    this.answerButton.isEnabled=!!s && !this.loading && !this.session.done;
    if (!s) { this.keys.forEach(k => k.hit.isEnabled = false); return; }
    const visibleCrosses=noteCrossedMasks(s,autoCandidateFiltering(this.preferences));
    if (!this.paused) {
      const masks=noteDisplayMasks(s,this.session.selected,this.session.pencil,autoCandidateFiltering(this.preferences),this.preferences.showCandidates);
      const lesson=this.lessonIndex>=0?this.session.hint?.steps[this.lessonIndex]:undefined;
      this.scene?.draw({ ...s, theme:this.preferences.theme, completed:this.session.done&&!this.loading, crossed:visibleCrosses, candidateMasks:masks, selected: this.session.selected, hint: this.session.hint?.cell ?? -1, language:this.preferences.language, ...(lesson?{lesson}:{}) });
      this.host?.requestFrame();
    }
    const choices = this.session.choices, led = s.puzzle.options.led !== false, selected = this.session.selected;
    this.keys.forEach((k, i) => {
      const enabled = !this.loading && choices.includes(i + 1); k.hit.isEnabled = enabled; k.digit.view.visibility = led ? 'visible' : 'collapse'; k.plain.visibility = led ? 'collapse' : 'visible'; k.plain.opacity = enabled ? 1 : .23; k.digit.set(SEGMENTS[i + 1]!, this.colors.accent, enabled, this.colors.tube);
      const crossed=this.session.pencil && !!((visibleCrosses[selected]??0)&(1<<i));
      k.strike.visibility=crossed?'visible':'collapse'; k.plain.color=new Color(crossed?this.colors.crossed:this.colors.accent);
      k.hit.accessibilityLabel=this.tr(this.session.pencil?(crossed?'restoreCandidate':'crossCandidate'):'enter',{n:i+1});
      k.tile.borderColor = new Color(this.colors.border);
    });
    this.notes.setActive(this.session.pencil); this.notes.setEnabled(!this.loading);
    this.undoButton.setEnabled(!this.loading && !!this.session.history.length); this.erase.setEnabled(!this.loading && editable(s, selected));
    this.hint.setEnabled(!this.loading && !this.session.done); this.explain.setEnabled(!this.loading && !this.session.done);
    const ruleCount = RULES.filter(([key]) => key !== 'led' && s.puzzle.options[key]).length;
    this.mode.text = `${led ? 'LED' : this.tr('classic')} · ${this.tr(s.puzzle.options.difficulty)}${ruleCount ? ' · '+this.tr('ruleCount',{n:ruleCount}) : ''}`;
    this.progress.text = this.session.done ? '✓ '+this.tr('completed') : `${s.board.filter(Boolean).length} / ${s.puzzle.blocked.filter(b => !b).length}`;
    this.cell.text = selected < 0 ? this.tr('selectCell') : this.tr('cell',{r:Math.floor(selected/9)+1,c:selected%9+1});
    this.canvas.accessibilityLabel = `${this.cell.text}。${this.details().join('')}`;
    const done = this.session.done && !this.loading;
    if (done && !this.wasComplete && !this.paused) this.startPulse();
    else if (!done) { this.stopPulse(); this.boardFrame.borderColor = new Color(this.colors.line); }
    if (!this.paused) this.wasComplete = done; this.updateClock();
  }
  private updateClock(): void {
    const t = Math.floor(this.session.state?.elapsed ?? 0); const text = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    if (text.length !== this.clockLength) {
      this.timerView.removeChildren(); this.clockDigits = []; this.clockLength = text.length;
      for (const char of text) { if (char === ':') { const colon = label(':', 20, this.colors.accent); colon.width = 8; colon.textAlignment = 'center'; this.timerView.addChild(colon); } else { const d = new LedDigit(.54); this.clockDigits.push(d); this.timerView.addChild(d.view); } }
    }
    [...text.replace(':','')].forEach((d, i) => this.clockDigits[i].set(d === '0' ? 0x3f : SEGMENTS[Number(d)]!, this.colors.accent, true, this.colors.tube));
    this.timerView.accessibilityLabel = this.tr('elapsed',{time:text});
  }
  private tick(): void { const now = Date.now(); if (this.session.state && !this.loading && !this.paused && !this.modal && !Application.inBackground && !this.session.done) this.session.state.elapsed += Math.min(2, (now - this.lastTick) / 1000); this.lastTick = now; }
  private startPulse(): void { this.stopPulse(); let n = 0; this.boardFrame.borderColor = new Color(this.colors.accent); this.pulse = setInterval(() => { this.boardFrame.borderColor = new Color(++n % 2 ? this.colors.pulse : this.colors.accent); if (n >= 8) this.stopPulse(); }, 700); }
  private stopPulse(): void { clearInterval(this.pulse); this.pulse = undefined; if (this.session.done) this.boardFrame.borderColor = new Color(this.colors.accent); }
  openExplanation(): void {
    if(this.modal||this.loading||!this.session.state)return;
    const text=this.session.explain(this.preferences.language);
    if(!this.session.hint){this.render();void this.showText(this.tr('inference'),text);return;}
    this.modal=true;this.lessonIndex=0;
    this.content.eachChild(view=>{if(view instanceof View&&view!==this.lessonPanel&&GridLayout.getRow(view)>=3)view.visibility='collapse';return true;});
    this.moveExplanation(0);
  }
  private moveExplanation(delta:number): void {
    const hint=this.session.hint;if(this.lessonIndex<0||!hint)return;
    if(this.lessonIndex+delta>=hint.steps.length){const applied=hint.kind==='elimination'&&this.session.applyHint();this.closeExplanation();if(applied)this.commit(lessonText(this.preferences.language,'候选已记入笔记，可继续提示或撤销。','Candidates recorded. Continue with another hint, or undo.','候補をメモに記録しました。次のヒントに進むか元に戻せます。'));return;}
    this.lessonIndex=Math.max(0,this.lessonIndex+delta);this.lessonPanel.show(hint.steps[this.lessonIndex]!,this.lessonIndex,hint.steps.length,this.preferences.language,hint.kind==='elimination');this.render();
  }
  closeExplanation(): void {
    if(this.lessonIndex<0)return;
    this.lessonIndex=-1;this.modal=false;this.lastTick=Date.now();this.lessonPanel.visibility='collapse';
    this.content.eachChild(view=>{if(view instanceof View&&view!==this.lessonPanel&&GridLayout.getRow(view)>=3)view.visibility='visible';return true;});this.render();
  }
  private async settings(): Promise<void> {
    if (this.modal || this.loading) return; this.modal = true; const release = this.host?.pausePresentation();
    let opts:Options|null=null;
    try { opts = await showSettings(this.page, this.session.state?.puzzle.options ?? DEFAULT_OPTIONS, this.preferences.language,this.preferences.theme); }
    finally { this.modal = false; release?.(); this.lastTick = Date.now(); }
    if (opts && !this.disposed) await this.newGame(opts);
  }
  async showText(title: string, message: string): Promise<void> { if (this.modal) return; this.modal = true; const release = this.host?.pausePresentation(); try { await alert({ title, message, okButtonText: this.tr('okay') }); } finally { this.modal = false; release?.(); this.lastTick = Date.now(); } }
  private async help(): Promise<void> {
    const puzzle=this.session.state?.puzzle;
    await this.showText(this.tr('rules'),[this.tr('basic'),...(puzzle?activeRuleDetails(puzzle,this.preferences.language):[])].join('\n\n'));
  }
  private async more(): Promise<void> {
    if (this.loading || this.modal || !this.session.state || this.session.done) return;
    this.modal = true; const release = this.host?.pausePresentation();
    try {
      if (await confirm({ title: this.tr('answerTitle'), message: this.tr('answerBody'), okButtonText: this.tr('answer'), cancelButtonText: this.tr('continue') })) { this.session.answer(); this.commit('答案已展示 · 辅助完成'); }
    } finally { this.modal = false; release?.(); this.render(); }
  }
  private localize(): void {
    this.titleLabel.text=this.tr('title');this.newButton.text='＋ '+this.tr('newGame');this.newButton.accessibilityLabel=this.tr('newGame');
    this.helpButton.text=this.tr('rules');this.helpButton.accessibilityLabel=this.tr('rules');this.answerButton.text=this.tr('answer');this.answerButton.accessibilityLabel=this.tr('answer');
    (['notes','undo','erase','hint','explain','settings'] as const).forEach((key,i)=>this.toolButtons[i]!.setLabel(this.tr(key)));
    this.keys.forEach((k,i)=>k.hit.accessibilityLabel=this.tr('enter',{n:i+1}));this.updateClock();
  }
  private applyTheme():void {
    const c=this.colors;this.page.className=this.preferences.theme;this.page.backgroundColor=new Color(c.background);this.root.backgroundColor=new Color(c.background);
    this.titleLabel.color=new Color(c.text);this.status.color=this.progress.color=new Color(c.muted);this.cell.color=this.mode.color=new Color(c.cyan);
    this.busy.color=new Color(c.accent);this.busy.backgroundColor=new Color(this.preferences.theme==='dark'?'#ee061015':'#eef3f9fe');
    this.boardFrame.borderColor=new Color(this.session.done?c.accent:c.line);
    this.toolButtons.forEach(b=>b.setTheme(this.preferences.theme));this.lessonPanel.setTheme(this.preferences.theme);
    this.keys.forEach(k=>{k.tile.backgroundColor=new Color(c.panel);k.strike.backgroundColor=new Color(c.strike);});
    this.clockLength=0;this.updateClock();
  }
  applyPreferences(value: Preferences): void {
    this.preferences=preferences(value);this.session.filterCandidates=autoCandidateFiltering(this.preferences);
    if(!this.smoke)writePreferences(this.preferences);this.applyTheme();this.localize();this.render();
  }
  private async openPreferences(): Promise<void> {
    if(this.modal||this.loading)return;this.modal=true;const release=this.host?.pausePresentation();
    try{await showPreferences(this.page,this.preferences,value=>this.applyPreferences(value));}
    finally{this.modal=false;release?.();this.lastTick=Date.now();this.render();}
  }
  async flush(): Promise<void> { if (this.session.state) this.save.save(structuredClone(this.session.state)); await this.save.flush(); }
  snapshot() { return { seed: this.session.state?.puzzle.seed, selected: this.session.selected, filled: this.session.state?.board.filter(Boolean).length, options: this.session.state?.puzzle.options, preferences:this.preferences, tools:this.toolButtons.map(b=>b.getActualSize()), title:this.titleLabel.text, splash: this.splash.status, root: this.root.getActualSize(), rootPosition: this.root.getLocationOnScreen(), content: this.content.getActualSize(), loading: this.loading, complete: this.session.done, completionSweep:this.scene?.animating??false, answerEnabled:this.answerButton.isEnabled, board: this.boardFrame.getActualSize(), keypad: this.keys.map(k=>k.tile.getActualSize()) }; }
  private readonly exit = (args: EventData & { android?: unknown }): void => { if (!args.android || args.android === this.activity) this.dispose(); };
  private readonly error = (args: {error?:unknown}): void => { this.host?.fail(args.error); };
  dispose(): void { if (this.disposed) return; this.tick(); void this.flush(); this.disposed = true; this.revision++; clearInterval(this.interval); this.stopPulse(); this.generator.dispose(); this.root.off('layoutChanged', this.layout); Application.off(Application.exitEvent, this.exit); Application.off(Application.uncaughtErrorEvent, this.error); this.host?.dispose(); this.host = null; this.splash.dispose(); }
}
