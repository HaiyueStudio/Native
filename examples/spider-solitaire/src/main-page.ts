import { startupTrace } from './startup-trace';
import { Application, EventData, Label, Page } from '@nativescript/core';
import type { Canvas } from '@nativescript/canvas';
import { LocalStorageSaveBackend } from '@haiyue/engine/save';
import { NativeRenderHost } from '../../../bridge/lifecycle/host';
import { NativeTouchInput } from '../../../bridge/input/native-touch.ios';
import type { NativeCanvasInput } from '../../../bridge/render/surface';
import { NativeCanvasTextures } from '../../../bridge/render/canvas-textures.ios';
import { NativeSettingsStorage } from '../../../bridge/storage/settings-storage';
import { SpiderSolitaire } from '../../../../Games/games/spider-solitaire/SpiderSolitaireGame';

let host: NativeRenderHost | null = null;
let game: SpiderSolitaire | null = null;
let activeCanvas: Canvas | null = null;
const ready = new WeakSet<Canvas>();
export function onCanvasReady(args: EventData): void { const canvas = args.object as Canvas; ready.add(canvas); ensureHost(canvas); }
export function onLoaded(args: EventData): void { const canvas = (args.object as Page).getViewById<Canvas>('surface'); if (canvas && ready.has(canvas)) ensureHost(canvas); }

function unhandled(args: { error?: unknown }): void { host?.fail(args.error); }
function ensureHost(canvas: Canvas): void {
  if (host && activeCanvas !== canvas) disposeHost();
  if (host) return;
  const page = canvas.page as Page;
  const status = page.getViewById<Label>('status');
  let textures: NativeCanvasTextures | null = null;
  const startup = startupTrace();
  let pendingEnd = false;
  const input = new NativeTouchInput(canvas, sample => {
    if (sample.action === 'up' || sample.action === 'cancel') pendingEnd = true;
    if (input.isPinching && sample.action === 'down') game?.cancelInteraction();
    if (['cancel', 'suspend', 'unloaded', 'dispose'].includes(sample.action)) game?.cancelInteraction();
  }, { pinchZoom: true });
  activeCanvas = canvas;
  host = new NativeRenderHost(canvas, text => {
    const presented = text.startsWith('原生 WebGPU 已呈现');
    status.visibility = presented ? 'collapse' : 'visible';
    status.text = presented ? '' : text.startsWith('正在初始化') ? '正在准备牌桌…' : text;
  }, {
    canvasInput: {
      addEventListener: input.target.addEventListener.bind(input.target),
      removeEventListener: input.target.removeEventListener.bind(input.target),
      setPointerCapture: (id: number) => { if (input.snapshot().primary === id) input.target.setPointerCapture(id); },
      releasePointerCapture: input.target.releasePointerCapture.bind(input.target),
    } as unknown as NativeCanvasInput,
    engineOptions: { msaaSamples: 4, clearColor: { r: 0.04, g: 0.11, b: 0.09, a: 1 } },
    diagnosticName: 'spider',
    disposeScene() { input.dispose(); game?.dispose(); game = null; textures?.dispose(); },
    capture: { requested: String(NSProcessInfo.processInfo.environment.objectForKey('SPIDER_CAPTURE_FRAME')) === '1', file: 'spider-frame.png' },
    prepareScene: async engine => {
      textures = new NativeCanvasTextures(engine.device);
      game = new SpiderSolitaire({ engine, autoRun: false, keyboard: false,
        createCanvas2D: textures.createCanvas2D, textureFromCanvas: textures.textureFromCanvas,
        saveBackend: new LocalStorageSaveBackend({ namespace: 'haiyue-games', storage: new NativeSettingsStorage() }),
        orbitCanvas: input.orbitTarget as unknown as HTMLCanvasElement,
        guiFont: {
          canvasFactory: (width, height) => { startup.trace(`font-canvas:${width}x${height}:enter`); const value = textures!.createCanvas2D(width, height); startup.trace('font-canvas:exit'); return value; },
          readAtlasPixels: atlas => { startup.trace('font-read:enter'); const value = textures!.readAtlasPixels(atlas); startup.trace('font-read:exit'); return value; },
        },
        isPinching: () => input.isPinching,
      });
      if (!engine.canvas) throw new Error('Native game requires a surface.');
      await game.init(engine.canvas);
      return { ...game.snapshot(), textures: textures.snapshot() };
    },
    bindInput: engine => {
      let firstFrame = true;
      const afterFrame = () => {
        if (firstFrame) { firstFrame = false; startup.stop(); }
        if (!pendingEnd) return;
        pendingEnd = false;
        // InteractionSystem processes queued pointerup during world.update.
        if (game?.snapshot().dragging) game.cancelInteraction();
      };
      engine.on('after-update', afterFrame);
      return {
        suspend() { input.suspend(); game?.cancelInteraction(); void game?.flushSave(); },
        resume() { input.resume(); },
        dispose() { input.dispose(); engine.off('after-update', afterFrame); },
        snapshot() { const state = game?.snapshot(); return { ...input.snapshot(), game: state && { autoSaveStatus: state.autoSaveStatus, moves: state.moves, stock: state.stock, difficulty: state.difficulty, camera: state.camera, dragging: state.dragging }, textures: textures?.snapshot() }; },
      };
    },
  });
  Application.on(Application.uncaughtErrorEvent, unhandled);
  Application.on(Application.exitEvent, disposeHost);
}
export function onUnloaded(): void { if (!Application.inBackground && !Application.suspended) disposeHost(); }
function disposeHost(): void {
  Application.off(Application.uncaughtErrorEvent, unhandled);
  Application.off(Application.exitEvent, disposeHost);
  host?.dispose(); host = null; activeCanvas = null;
}
