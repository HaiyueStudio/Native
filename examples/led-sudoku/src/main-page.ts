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
import { RULES, showSettings } from './settings';
import { isDevelopmentBuild } from './development';
import { captureDiagnostics } from './diagnostics';
import { runSmoke } from './smoke';
import type { NativeEngineLaunchPage } from '../../../bridge/branding/launch-page';
import { captureNativeView } from '../../../bridge/render/view-capture';

const C = { text: '#d6e9ea', muted: '#8ba6ae', mint: '#83ffc1', cyan: '#75e4ef', line: '#355760' };
function label(text: string, size = 12, color = C.text): Label { const l = new Label(); l.text = text; l.fontSize = size; l.color = new Color(color); l.verticalAlignment = 'middle'; return l; }
function button(text: string, action: () => void, name = ''): Button { const b = new Button(); b.text = text; b.id = name; b.accessibilityLabel = text; b.on('tap', action); return b; }
let active: MobileGame | null = null;
export function onLoaded(e: EventData): void { const page = e.object as Page; if (active?.page === page) return; active?.dispose(); active = new MobileGame(page); }
export function onUnloaded(e: EventData): void { if (active?.page !== e.object || active.modal) return; if (!Application.inBackground && !Application.suspended) { active.dispose(); active = null; } }

export class MobileGame {
  readonly session = new MobileSession();
  readonly canvas = new Canvas();
  readonly content = new GridLayout();
  readonly boardFrame = new GridLayout();
  readonly keys: { tile: GridLayout; digit: LedDigit; plain: Label; hit: Button }[] = [];
  readonly timerView = new StackLayout();
  readonly status = label('正在启动原生引擎…', 11, C.muted);
  readonly cell = label('请选择一个格子', 11, C.cyan);
  readonly mode = label('LED · 标准', 10, C.cyan);
  readonly progress = label('', 10, C.muted);
  readonly busy = label('正在启动原生引擎…', 14, C.mint);
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
  private readonly notes: Button;
  private readonly undoButton: Button;
  private readonly erase: Button;
  private readonly hint: Button;
  private readonly explain: Button;
  private readonly newButton: Button;
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
    this.smoke = dev && nativeLaunchFlag('LED_SMOKE');
    this.diagnosticCapture = dev && nativeLaunchFlag('LED_CAPTURE');
    this.captureSplash = this.smoke || this.diagnosticCapture;
    this.save = new SingleSlotGameSave({ gameId: 'led-sudoku', name: '流光数独自动存档', validateData: isSaveData, backend: new LocalStorageSaveBackend({ namespace: this.smoke ? 'led-native-smoke' : 'haiyue-games', storage: new NativeSettingsStorage() }), onStatus: s => { if (s === 'error') this.message('存档失败，请检查设备存储。'); } });
    this.content.rows = portraitLayout(360, 800).rows; this.content.padding = '0 10';
    this.scroll.content = this.content; this.root.addChild(this.scroll);
    const head = new GridLayout(); head.columns = '*,auto'; const title = label('流光数独', 23); title.fontWeight = 'bold'; head.addChild(title);
    this.timerView.orientation = 'horizontal'; this.timerView.verticalAlignment = 'middle'; GridLayout.setColumn(this.timerView, 1); head.addChild(this.timerView); this.add(head, 0);
    const meta = new GridLayout(); meta.columns = '*,auto'; this.mode.textWrap = false; meta.addChild(this.mode); GridLayout.setColumn(this.progress, 1); meta.addChild(this.progress); this.add(meta, 1);
    this.boardFrame.borderWidth = 1; this.boardFrame.borderRadius = 5; this.boardFrame.borderColor = new Color(C.line); this.boardFrame.padding = 3; this.boardFrame.horizontalAlignment = 'center';
    this.canvas.id = 'board'; this.canvas.ignoreTouchEvents = true; this.canvas.on('ready', () => this.attach()); this.boardFrame.addChild(this.canvas);
    this.busy.textAlignment = 'center'; this.busy.textWrap = true; this.busy.backgroundColor = new Color('#ee061015'); this.boardFrame.addChild(this.busy); this.add(this.boardFrame, 2);
    const tools = new GridLayout(); tools.columns = '*,*,*,*,*';
    this.notes = button('笔记', () => { this.session.pencil = !this.session.pencil; this.render(); }, 'notes');
    this.undoButton = button('撤销', () => { if (this.session.undo()) this.commit('已撤销上一步。'); }, 'undo');
    this.erase = button('擦除', () => this.enter(0), 'erase');
    this.hint = button('提示', () => { this.message(this.session.explain()); this.render(); }, 'hint');
    this.explain = button('解释', () => { const text = this.session.explain(); this.render(); void this.showText('推理解释', [text, ...this.details()].join('\n\n')); }, 'explain');
    [this.notes, this.undoButton, this.erase, this.hint, this.explain].forEach((b, i) => { GridLayout.setColumn(b, i); tools.addChild(b); }); this.add(tools, 3);
    this.add(this.cell, 4);
    const keypad = new GridLayout(); keypad.rows = '*,*,*'; keypad.columns = '*,*,*';
    for (let d = 1; d <= 9; d++) {
      const tile = new GridLayout(); tile.className = 'key-tile'; const digit = new LedDigit(.85); digit.view.horizontalAlignment = 'center'; digit.view.verticalAlignment = 'middle'; tile.addChild(digit.view);
      const plain = label(String(d), 28, C.mint); plain.textAlignment = 'center'; tile.addChild(plain);
      const hit = button(`填入 ${d}`, () => this.enter(d), `digit-${d}`); hit.className = 'key-hit'; tile.addChild(hit);
      GridLayout.setRow(tile, Math.floor((d - 1) / 3)); GridLayout.setColumn(tile, (d - 1) % 3); keypad.addChild(tile); this.keys.push({ tile, digit, plain, hit });
    }
    this.add(keypad, 5);
    this.status.textWrap = true; this.status.maxLines = 2; this.status.on('tap', () => void this.showText('本格规则', this.details().join('\n\n') || this.status.text)); this.add(this.status, 6);
    const footer = new GridLayout(); footer.columns = '2*,*,*';
    this.newButton = button('＋ 新数独', () => void this.settings(), 'new'); this.newButton.className = 'primary'; footer.addChild(this.newButton);
    const help = button('规则', () => void this.help(), 'help'); GridLayout.setColumn(help, 1); footer.addChild(help);
    const more = button('答案', () => void this.more(), 'more'); GridLayout.setColumn(more, 2); footer.addChild(more); this.add(footer, 8);
    this.root.on('layoutChanged', this.layout); Application.on(Application.exitEvent, this.exit); Application.on(Application.uncaughtErrorEvent, this.error);
    this.layout(); this.updateClock();
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
  };
  private attach(): void {
    if (this.host || this.disposed) return;
    this.input = new NativeTouchInput(this.canvas, sample => {
      const point = sample.points[0];
      if (sample.action === 'down' && point && sample.input.primary === point.id) this.down = { id: point.id, x: point.x, y: point.y };
      else if (sample.action === 'up' && point && this.down?.id === point.id) {
        const start = this.down; this.down = null;
        if (!this.loading && Math.hypot(start.x - point.x, start.y - point.y) < 12) {
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
      else if (text.startsWith('初始化或渲染失败')) { this.splash.fail(); this.busy.visibility = 'visible'; this.busy.text = text; this.message(text); }
    }, {
      diagnosticName: 'led-sudoku', capture: { requested: this.smoke || this.diagnosticCapture, file: 'led-sudoku-board.png' }, diagnosticIntervalFrames: 0, needsAnimationFrame: () => false,
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
        if (this.smoke) setTimeout(() => { if (!this.disposed) void runSmoke(this, report).then(() => setTimeout(() => { if (!this.disposed) { try { report('screen-capture', captureDiagnostics(this.page)); } catch (e) { report('screen-capture-error', String(e)); } } }, 500)); }, 1000);
        if (this.diagnosticCapture && !this.smoke) setTimeout(() => {
          if (this.disposed) return;
          report('settled-layout', this.snapshot());
          try { report('screen-capture', captureDiagnostics(this.page)); }
          catch (e) { report('screen-capture-error', String(e)); }
        }, 2000);
        return { suspend: () => { this.tick(); this.paused = true; this.input?.suspend(); this.stopPulse(); void this.flush(); }, resume: () => { this.paused = false; this.lastTick = Date.now(); this.input?.resume(); this.render(); }, dispose: () => this.input?.dispose(), snapshot: () => ({ input: this.input?.snapshot(), game: this.snapshot() }) };
      },
      disposeScene: () => { this.scene?.dispose(); this.scene = null; this.input?.dispose(); },
    });
  }
  async newGame(options: Options, seed = Date.now() >>> 0): Promise<void> {
    const revision = ++this.revision; this.loading = true; this.busy.text = options.difficulty === 'hard' ? '正在验证唯一解并筛选挑战难度…' : '正在出题并验证唯一解…'; this.busy.visibility = 'visible'; this.message('正在生成新数独…'); this.render();
    try {
      const g = await this.generator.generate(options, seed); if (!g || this.disposed || revision !== this.revision) return;
      this.session.start(g); this.lastTick = Date.now(); this.loading = false; this.commit(options.led !== false ? '新数独已就绪 · 全暗灯管格也可填数' : '新数独已就绪 · 选择空格开始填写');
    } catch (e) { this.message(String(e)); this.busy.text = `${String(e)}\n请点“新数独”重试`; }
    finally { if (!this.disposed && revision === this.revision) { this.loading = false; this.render(); if (this.session.state && this.firstPresentation) this.busy.visibility = 'collapse'; } }
  }
  enter(d: number): void {
    if (this.loading || this.paused || !this.session.input(d)) return;
    const s = this.session.state!;
    this.commit(this.session.done ? s.assisted ? '棋局完成 · 使用过答案辅助' : '恭喜完成！' : this.session.pencil && d ? '候选笔记已更新' : d && s.board[this.session.selected] !== s.solution[this.session.selected] ? '该数字与答案不符，可擦除或撤销。' : '进度已保存');
  }
  commit(text: string): void { this.render(); this.message(text); if (this.session.state) this.save.save(structuredClone(this.session.state)); }
  message(text: string): void { if (!this.disposed) this.status.text = text; }
  details(): string[] { return this.session.state ? cellRuleDetails(this.session.state.puzzle, this.session.selected) : []; }
  render(): void {
    if (this.disposed) return;
    const s = this.session.state;
    this.newButton.isEnabled = !this.loading;
    if (!s) { this.keys.forEach(k => k.hit.isEnabled = false); return; }
    if (!this.paused) { this.scene?.draw({ ...s, selected: this.session.selected, hint: this.session.hint?.cell ?? -1 }); this.host?.requestFrame(); }
    const choices = this.session.choices, led = s.puzzle.options.led !== false, selected = this.session.selected;
    this.keys.forEach((k, i) => {
      const enabled = !this.loading && choices.includes(i + 1); k.hit.isEnabled = enabled; k.digit.view.visibility = led ? 'visible' : 'collapse'; k.plain.visibility = led ? 'collapse' : 'visible'; k.plain.opacity = enabled ? 1 : .23; k.digit.set(SEGMENTS[i + 1]!, C.mint, enabled);
      k.tile.borderColor = new Color(this.session.pencil && (s.notes[selected]! & (1 << i)) ? C.mint : '#29464e');
    });
    this.notes.className = this.session.pencil ? 'active' : ''; this.notes.isEnabled = !this.loading;
    this.undoButton.isEnabled = !this.loading && !!this.session.history.length; this.erase.isEnabled = !this.loading && editable(s, selected);
    this.hint.isEnabled = this.explain.isEnabled = !this.loading && !this.session.done;
    const ruleCount = RULES.filter(([key]) => key !== 'led' && s.puzzle.options[key]).length;
    this.mode.text = `${led ? 'LED' : '常规'} · ${{easy:'入门',normal:'标准',hard:'挑战'}[s.puzzle.options.difficulty]}${ruleCount ? ` · ${ruleCount} 项附加规则` : ''}`;
    this.progress.text = this.session.done ? '✓ 已完成' : `${s.board.filter(Boolean).length} / ${s.puzzle.blocked.filter(b => !b).length}`;
    const basic = editable(s, selected) ? candidates(s.puzzle, s.board, selected, false) : [];
    this.cell.text = selected < 0 ? '棋局已完成' : `R${Math.floor(selected / 9) + 1} · C${selected % 9 + 1}    ${editable(s, selected) ? `${choices.length} 个候选${led && choices.length < basic.length ? ` / LED 排除 ${basic.filter(d=>!choices.includes(d)).join('、')}` : ''}` : '完整已知数'}`;
    this.canvas.accessibilityLabel = `${this.cell.text}。${this.details().join('')}`;
    const done = this.session.done && !this.loading;
    if (done && !this.wasComplete && !this.paused) this.startPulse();
    else if (!done) { this.stopPulse(); this.boardFrame.borderColor = new Color(C.line); }
    if (!this.paused) this.wasComplete = done; this.updateClock();
  }
  private updateClock(): void {
    const t = Math.floor(this.session.state?.elapsed ?? 0); const text = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    if (text.length !== this.clockLength) {
      this.timerView.removeChildren(); this.clockDigits = []; this.clockLength = text.length;
      for (const char of text) { if (char === ':') { const colon = label(':', 20, C.mint); colon.width = 8; colon.textAlignment = 'center'; this.timerView.addChild(colon); } else { const d = new LedDigit(.54); this.clockDigits.push(d); this.timerView.addChild(d.view); } }
    }
    [...text.replace(':','')].forEach((d, i) => this.clockDigits[i].set(d === '0' ? 0x3f : SEGMENTS[Number(d)]!, C.mint));
    this.timerView.accessibilityLabel = `用时 ${text}`;
  }
  private tick(): void { const now = Date.now(); if (this.session.state && !this.loading && !this.paused && !this.modal && !Application.inBackground && !this.session.done) this.session.state.elapsed += Math.min(2, (now - this.lastTick) / 1000); this.lastTick = now; }
  private startPulse(): void { this.stopPulse(); let n = 0; this.boardFrame.borderColor = new Color(C.mint); this.pulse = setInterval(() => { this.boardFrame.borderColor = new Color(++n % 2 ? '#3d7862' : C.mint); if (n >= 8) this.stopPulse(); }, 700); }
  private stopPulse(): void { clearInterval(this.pulse); this.pulse = undefined; if (this.session.done) this.boardFrame.borderColor = new Color(C.mint); }
  private async settings(): Promise<void> {
    if (this.modal || this.loading) return; this.modal = true; const release = this.host?.pausePresentation();
    try { const opts = await showSettings(this.page, this.session.state?.puzzle.options ?? DEFAULT_OPTIONS); release?.(); if (opts && !this.disposed) await this.newGame(opts); }
    finally { this.modal = false; release?.(); this.lastTick = Date.now(); }
  }
  async showText(title: string, message: string): Promise<void> { if (this.modal) return; this.modal = true; const release = this.host?.pausePresentation(); try { await alert({ title, message, okButtonText: '知道了' }); } finally { this.modal = false; release?.(); this.lastTick = Date.now(); } }
  private async help(): Promise<void> {
    const puzzle = this.session.state?.puzzle, options = puzzle?.options ?? DEFAULT_OPTIONS;
    const rules = RULES.filter(([k]) => options[k]).map(([k,n,d]) => k === 'renban' && puzzle ? lineRuleDescription(puzzle) : `${n}：${d}`).join('\n');
    const details = ['每行、列、宫数字不重复。', rules];
    if (options.led) details.push('亮段必须包含在答案中，暗段未知。全暗灯管格仍需填写。');
    if (options.missing) details.push('只有 × 黑格不填。');
    if (options.exclusion) details.push(options.led ? '排除点的部分 LED 会排除所有匹配亮段的数字。点选周围格子，再点底部说明查看排除列表。左上竖管匹配 4、5、6、8、9。' : '点选排除点周围的格子，再点底部说明查看排除列表。');
    if (options.skyscraper) details.push('从数字所在的一侧向内看，高楼会遮住后方较矮的楼。盘面外圈不参与填数。');
    if (options.quadruple) details.push('蓝色菱形 Σ 是四格总和，不额外要求四格互异；仍遵守行、列、宫规则。');
    if (options.multiDiagonal) details.push('金色短斜线只要求数字不重复，不要求出现全部 1–9。');
    await this.showText('本局规则', details.filter(Boolean).join('\n\n'));
  }
  private async more(): Promise<void> {
    if (this.loading || this.modal || !this.session.state) return;
    this.modal = true; const release = this.host?.pausePresentation();
    try {
      if (await confirm({ title: '显示完整答案？', message: '本局将记为辅助完成，可以撤销。', okButtonText: '显示答案', cancelButtonText: '继续推理' })) { this.session.answer(); this.commit('答案已展示 · 辅助完成'); }
    } finally { this.modal = false; release?.(); this.render(); }
  }
  async flush(): Promise<void> { if (this.session.state) this.save.save(structuredClone(this.session.state)); await this.save.flush(); }
  snapshot() { return { seed: this.session.state?.puzzle.seed, selected: this.session.selected, filled: this.session.state?.board.filter(Boolean).length, options: this.session.state?.puzzle.options, splash: this.splash.status, root: this.root.getActualSize(), rootPosition: this.root.getLocationOnScreen(), content: this.content.getActualSize(), loading: this.loading, complete: this.session.done, board: this.boardFrame.getActualSize(), keypad: this.keys.map(k=>k.tile.getActualSize()) }; }
  private readonly exit = (args: EventData & { android?: unknown }): void => { if (!args.android || args.android === this.activity) this.dispose(); };
  private readonly error = (args: {error?:unknown}): void => { this.host?.fail(args.error); };
  dispose(): void { if (this.disposed) return; this.tick(); void this.flush(); this.disposed = true; this.revision++; clearInterval(this.interval); this.stopPulse(); this.generator.dispose(); this.root.off('layoutChanged', this.layout); Application.off(Application.exitEvent, this.exit); Application.off(Application.uncaughtErrorEvent, this.error); this.host?.dispose(); this.host = null; this.splash.dispose(); }
}
