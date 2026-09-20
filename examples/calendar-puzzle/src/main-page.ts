import { PurchaseController } from '../../../bridge/purchases/controller';
import { CalendarStore } from './purchases/store';
import { isDevelopmentBuild } from './development';
import { nativeLaunchFlag } from '../../../bridge/lifecycle/launch-flags';
import { NativePcmAudioBank } from '../../../bridge/audio/pcm-bank';
import { CALENDAR_SOUNDS, CALENDAR_SOUND_IDS } from '../../../../Games/games/calendar-puzzle/audio/Sounds';
import type { CalendarSolverWorker } from '../../../../Games/games/calendar-puzzle/solver-client';
import { installCalendarSmoke, seedCalendarSmoke } from './smoke';
import { Application, EventData, GridLayout, Page, knownFolders, path, Connectivity } from '@nativescript/core';
import { NativeEngineSplash } from '../../../bridge/branding/engine-splash';
import { captureNativeView } from '../../../bridge/render/view-capture';
import type { Canvas } from '@nativescript/canvas';
import { NativeRenderHost } from '../../../bridge/lifecycle/host';
import { NativeTouchInput } from '../../../bridge/input/native-touch';
import type { NativeCanvasInput } from '../../../bridge/render/surface';
import { NativeCanvasTextures } from '../../../bridge/render/canvas-textures';
import { LocalStorageSaveBackend } from '@haiyue/engine/save';
import { NativeSettingsStorage } from '../../../bridge/storage/settings-storage';
import { CalendarPuzzleGame } from '../../../../Games/games/calendar-puzzle/CalendarPuzzleGame';
let host: NativeRenderHost | null = null;
let activeCanvas: Canvas | null = null;
let activePage: Page | null = null;
let activeActivity: unknown = null;
let splash: NativeEngineSplash | null = null;
const ready = new WeakSet<Canvas>();
export function onCanvasReady(args: EventData): void {
  const canvas = args.object as Canvas;
  ready.add(canvas);
  ensureHost(canvas);
}
export function onLoaded(args: EventData): void {
  ensureSplash(args.object as Page);
  const canvas = (args.object as Page).getViewById<Canvas>('surface');
  if (canvas && ready.has(canvas)) ensureHost(canvas);
}
function ensureSplash(page: Page): NativeEngineSplash {
  return splash ??= new NativeEngineSplash(page.getViewById<GridLayout>('appRoot'));
}
function unhandled(args: { error?: unknown }): void {
  host?.fail(args.error);
}
function ensureHost(canvas: Canvas): void {
  if (host && activeCanvas !== canvas) disposeHost();
  if (host) return;
  const loading = ensureSplash(canvas.page as Page);
  let textures: NativeCanvasTextures | null = null;
  let game: CalendarPuzzleGame | null = null;
  const launchFlag = (name: string) => isDevelopmentBuild() && nativeLaunchFlag(name);
  const input = new NativeTouchInput(canvas, (sample) => {
    if (['cancel', 'suspend', 'unloaded', 'dispose'].includes(sample.action)) game?.cancelInteraction();
  });
  const smoke = launchFlag('CALENDAR_SMOKE');
  const performance = launchFlag('CALENDAR_PERFORMANCE');
  const purchases = smoke ? undefined : new PurchaseController(new CalendarStore());
  if (purchases) {
    Connectivity.startMonitoring(type => { if (type !== Connectivity.connectionType.none) void purchases.refresh(); });
    void purchases.refresh();
  }
  let captureSplash = launchFlag('CALENDAR_SPLASH_CAPTURE');
  const backend = new LocalStorageSaveBackend({ namespace: smoke ? 'calendar-history-smoke' : 'haiyue-games', storage: new NativeSettingsStorage() });
  let removeSmoke: (() => void) | undefined;
  activeCanvas = canvas;
  activePage = canvas.page as Page;
  activeActivity = canvas._context;
  host = new NativeRenderHost(
    canvas,
    (text) => {
      const presented = text.startsWith('原生 WebGPU 已呈现');
      if (presented && captureSplash) {
        captureSplash = false;
        try { captureNativeView(loading.view, 'calendar-engine-splash.png'); }
        catch (error) { console.error('Splash capture failed', error); }
      }
      if (presented) loading.presented();
      else if (text.startsWith('初始化或渲染失败')) loading.fail();
    },
    {
      canvasInput: {
        addEventListener: input.target.addEventListener.bind(input.target),
        removeEventListener: input.target.removeEventListener.bind(input.target),
        setPointerCapture: (id: number) => {
          if (input.snapshot().primary === id) input.target.setPointerCapture(id);
        },
        releasePointerCapture: input.target.releasePointerCapture.bind(input.target),
      } as unknown as NativeCanvasInput,
      engineOptions: { msaaSamples: 4, clearColor: { r: 0.92, g: 0.96, b: 0.92, a: 1 } },
      diagnosticName: 'calendar-puzzle',
      performance,
      needsAnimationFrame: () => game?.needsAnimationFrame() ?? false,
      diagnosticIntervalFrames: smoke || performance ? 120 : 0,
      capture: {
        requested: launchFlag('CALENDAR_CAPTURE_FRAME'),
        file: 'calendar-puzzle-frame.png',
      },
      prepareScene: async (engine) => {
        textures = new NativeCanvasTextures(engine.device, 'rgba8unorm-srgb');
        game = new CalendarPuzzleGame({
          purchases, engine, autoRun: false, keyboard: false, touchControls: true,
          requestRender: () => host?.requestFrame(),
          createCanvas2D: textures.createCanvas2D, textureFromCanvas: textures.textureFromCanvas,
          saveBackend: backend,
          audioBackend: new NativePcmAudioBank(CALENDAR_SOUND_IDS.map(id => ({ id, seconds: CALENDAR_SOUNDS[id].seconds, path: path.join(knownFolders.currentApp().path, 'game-assets', 'audio', id + '.wav') })), () => game?.suspendAudio()),
          createSolverWorker: () => new Worker('./solver.worker') as unknown as CalendarSolverWorker,
          guiFont: { canvasFactory: textures.createCanvas2D, readAtlasPixels: textures.readAtlasPixels },
        });
        if (!engine.canvas) throw new Error('Native surface is unavailable.');
        if (smoke) await seedCalendarSmoke(backend);
        await game.init(engine.canvas);
        return game.snapshot();
      },
      disposeScene() {
        removeSmoke?.();
        if (purchases) { Connectivity.stopMonitoring(); purchases.dispose(); }
        game?.dispose();
        game = null;
        input.dispose();
        textures?.dispose();
      },
      bindInput: (engine, report) => {
        if (smoke && game) removeSmoke = installCalendarSmoke(engine, game, input, backend, report, canvas, launchFlag('CALENDAR_SMOKE_CLEAN'), () => host?.requestFrame(), () => host!.renderingSnapshot());
        return ({
        suspend() {
          game?.suspendAudio();
          input.suspend();
          game?.cancelInteraction();
          void game?.flushSave();
        },
        resume() {
          input.resume();
          void purchases?.refresh();
        },
        dispose() {
          input.dispose();
        },
        snapshot() {
          return { ...input.snapshot(), game: game?.snapshot(), textures: textures?.snapshot() };
        },
      }); },
    },
  );
  Application.on(Application.uncaughtErrorEvent, unhandled);
  Application.on(Application.exitEvent, onExit);
}
export function onUnloaded(args: EventData): void {
  // Android may finish the previous Activity after the new Page is ready.
  if (args.object !== activePage) return;
  if (!Application.inBackground && !Application.suspended) disposeHost();
}
function onExit(args: EventData & { android?: unknown }): void {
  if (args.android && args.android !== activeActivity) return;
  disposeHost();
}
function disposeHost(): void {
  Application.off(Application.uncaughtErrorEvent, unhandled);
  Application.off(Application.exitEvent, onExit);
  host?.dispose();
  host = null;
  activeCanvas = null;
  activePage = null;
  activeActivity = null;
  splash?.dispose();
  splash = null;
}
