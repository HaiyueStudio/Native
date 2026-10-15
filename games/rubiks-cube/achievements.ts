import { AchievementRuntime, AchievementGui, type AchievementDefinition, type AchievementPort, type AchievementRuleStorage } from '@haiyue/extensions/achievements';
import { I18n, collectLocaleCharacters, type LocalePack } from '@haiyue/extensions/i18n';
import { GuiButton, GuiElement, type GuiRoot } from '@haiyue/engine/gui';
import type { CubeSolve } from './session';

export const cubeAchievementDefinitions: AchievementDefinition[] = [
  { id: 'rubik.first', target: 1, titleKey: 'first', descriptionKey: 'first.desc', rule: { kind: 'fact', event: 'solve' } },
  { id: 'rubik.ten', target: 10, titleKey: 'ten', descriptionKey: 'ten.desc', rule: { kind: 'counter', event: 'solve', field: 'count' } },
  { id: 'rubik.fast', target: 1, titleKey: 'fast', descriptionKey: 'fast.desc', rule: { kind: 'fact', event: 'fast' } },
  { id: 'rubik.mirror', target: 1, titleKey: 'mirror', descriptionKey: 'mirror.desc', hidden: true, rule: { kind: 'fact', event: 'mirror' } },
];
export const cubeAchievementPacks: LocalePack[] = [
  { schemaVersion: 1, locale: 'zh-CN', messages: { achievements: '成就', close: '关闭', first: '初次破解', 'first.desc': '打乱后手动完成一次魔方', ten: '熟能生巧', 'ten.desc': '累计手动完成十次魔方', fast: '争分夺秒', 'fast.desc': '两分钟内手动完成三阶魔方', mirror: '镜中世界', 'mirror.desc': '手动完成镜面魔方', hidden: '隐藏成就', locked: '尚未解锁', unlocked: '成就解锁', local: '本地', queued: '待同步', accepted: '平台已接受', reconciled: '已读回', failed: '同步失败' } },
  { schemaVersion: 1, locale: 'en', messages: { achievements: 'Achievements', close: 'Close', first: 'First solve', 'first.desc': 'Solve a shuffled cube manually', ten: 'Practice makes perfect', 'ten.desc': 'Solve ten shuffled cubes manually', fast: 'Against the clock', 'fast.desc': 'Solve a 3x3 in two minutes', mirror: 'Mirror world', 'mirror.desc': 'Solve a mirror cube manually', hidden: 'Hidden achievement', locked: 'Locked', unlocked: 'Achievement unlocked', local: 'Local', queued: 'Queued', accepted: 'Platform accepted', reconciled: 'Read back', failed: 'Sync failed' } },
];
/** Game owns this presenter/runtime; host injects storage and a session-scoped port. */
export class CubeAchievements {
  readonly chars = collectLocaleCharacters(cubeAchievementPacks) + '中文';
  readonly runtime: AchievementRuntime;
  readonly i18n = new I18n({ locale: 'zh-CN', fallbackLocale: 'en' });
  private view?: AchievementGui;
  private overlay?: GuiElement;
  private root?: GuiRoot;
  private button?: GuiButton;
  private visibilityChanged?: (visible: boolean) => void;
  private jobs: Promise<void> = Promise.resolve();
  private dead = false;
  private sequence = 0;
  private readonly runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  get visible() { return this.overlay?.visible ?? false; }
  show() { this.setVisible(true); }
  private setVisible(visible: boolean) { this.overlay?.setVisible(visible); this.visibilityChanged?.(visible); }
  constructor(options: { port: AchievementPort; storage: AchievementRuleStorage; profile: string; flush?: () => Promise<unknown>; onError?: (error: unknown) => void }) {
    this.runtime = new AchievementRuntime({ definitions: cubeAchievementDefinitions, definitionVersion: '1', profile: options.profile, port: options.port, storage: options.storage });
    this.flushPlatform = options.flush; this.onError = options.onError ?? (e => console.error('Achievements:', e));
    cubeAchievementPacks.forEach(p => this.i18n.register(p));
  }
  private readonly flushPlatform: (() => Promise<unknown>) | undefined;
  private readonly onError: (error: unknown) => void;
  async initialize() { await this.runtime.initialize(); try { await this.runtime.sync(); await this.flushPlatform?.(); } catch (error) { this.onError(error); } }
  attach(root: GuiRoot, visibilityChanged?: (visible: boolean) => void) {
    this.root = root;
    this.visibilityChanged = visibilityChanged;
    const overlay = this.overlay = root.add(new GuiElement({ width: '100%', height: '100%', visible: false, style: { backgroundColor: '#0c192a' } }));
    const close = overlay.add(new GuiButton({ x: 12, y: 12, width: 90, height: 36, text: '关闭', onClick: () => this.setVisible(false) }));
    const language = overlay.add(new GuiButton({ x: 115, y: 12, width: 100, height: 36, text: 'EN / 中文', onClick: () => { void this.i18n.setLocale(this.i18n.locale === 'en' ? 'zh-CN' : 'en').catch(this.onError); } }));
    this.view = new AchievementGui(this.runtime, { parent: overlay, toastParent: root.root, i18n: this.i18n, hiddenKey: 'hidden', lockedKey: 'locked', unlockedKey: 'unlocked', bounds: { x: 0, y: 60, width: '100%', height: '82%' }, syncKeys: { 'local-only': 'local', queued: 'queued', 'provider-accepted': 'accepted', reconciled: 'reconciled', failed: 'failed' } });
    this.view.toast.layout = r => { this.view!.toast.rect = { x: 10, y: 108, width: Math.max(1, r.width - 20), height: 42 }; };
    this.button = root.add(new GuiButton({ text: '成就', onClick: () => this.setVisible(!overlay.visible) }));
    this.button.layout = r => { this.button!.rect = { x: r.width - 88, y: r.height - 42, width: 76, height: 32 }; };
    this.i18n.subscribe(() => { close.setText(this.i18n.text('close')); this.button?.setText(this.i18n.text('achievements')); });
    void language;
  }
  solved(result: CubeSolve) {
    if (this.dead) return;
    const id = `${this.runId}:${++this.sequence}`;
    this.jobs = this.jobs.then(async () => {
      if (this.dead) return;
      await this.runtime.record({ id: `${id}:solve`, type: 'solve', values: { count: 1 } });
      if (result.kind === '3' && result.seconds <= 120) await this.runtime.record({ id: `${id}:fast`, type: 'fast' });
      if (result.kind === 'mirror') await this.runtime.record({ id: `${id}:mirror`, type: 'mirror' });
      await this.runtime.sync(); await this.flushPlatform?.();
    }).catch(this.onError);
  }
  flush(): Promise<void> { return this.jobs; }
  dispose() { if (this.dead) return; this.dead = true; this.setVisible(false); this.visibilityChanged = undefined; this.view?.dispose(); if (this.overlay) this.root?.remove(this.overlay); if (this.button) this.root?.remove(this.button); this.runtime.dispose(); this.i18n.dispose(); }
}
