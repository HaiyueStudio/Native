import { RangeHaptics } from './haptics.ios';
import { LocalStorageSaveBackend, MemorySaveBackend } from '@haiyue/engine/save';
import { NativeSettingsStorage } from '../../../bridge/storage/settings-storage';
import { captureNativePointer } from './pointer-capture';
import { verifyNativeRange } from './verification';
import { verifyNativeMotion } from './motion-verification';
import { Application, EventData, Label, Page } from '@nativescript/core';
import type { Canvas } from '@nativescript/canvas';
import { NativeRenderHost } from '../../../bridge/lifecycle/host';
import { NativeTouchInput } from '../../../bridge/input/native-touch.ios';
import type { NativeCanvasInput } from '../../../bridge/render/surface';
import { NativeCanvasTextures } from '../../../bridge/render/canvas-textures.ios';
import { NativeModels } from './models';
import { OrbitPointerTarget } from '../../../bridge/input/pointer-target';
import { nativeViewRect } from '../../../bridge/render/view-rect.ios';
import { RangeGame } from '../../../games/ak47-range/RangeGame';
let host: NativeRenderHost | null = null;
let game: RangeGame | null = null;
let activeCanvas: Canvas | null = null;
const ready = new WeakSet<Canvas>();
export function onCanvasReady(args: EventData): void {
  const canvas = args.object as Canvas;
  ready.add(canvas);
  ensureHost(canvas);
}
export function onLoaded(args: EventData): void {
  const canvas = (args.object as Page).getViewById<Canvas>('surface');
  if (canvas && ready.has(canvas)) ensureHost(canvas);
}
function unhandled(args: { error?: unknown }): void {
  host?.fail(args.error);
}
function ensureHost(canvas: Canvas): void {
  if (host && activeCanvas !== canvas) disposeHost();
  if (host) return;
  const status = (canvas.page as Page).getViewById<Label>('status');
  const haptics = new RangeHaptics();
  let verifying = String(NSProcessInfo.processInfo.environment.objectForKey('RANGE_VERIFY')) === '1';
  let textures: NativeCanvasTextures | null = null;
  let models: NativeModels | null = null;
  let disposeMotionProbe: (() => void) | null = null;
  const target = new OrbitPointerTarget(() => nativeViewRect(canvas), 'all');
  const input = new NativeTouchInput(canvas, (sample) => {
    if (verifying) return; // Keep scripted verification deterministic; real UITouch resumes immediately afterward.
    if (['down', 'move', 'up', 'cancel'].includes(sample.action)) target.handle(sample.action as 'down' | 'move' | 'up' | 'cancel', sample.points);
    else { target.cancel(); game?.cancelInteraction(); }
  });
  activeCanvas = canvas;
  host = new NativeRenderHost(
    canvas,
    (text) => {
      const presented = text.startsWith('原生 WebGPU 已呈现');
      status.visibility = presented ? 'collapse' : 'visible';
      status.text = presented ? '' : text;
    },
    {
      canvasInput: {
        addEventListener: target.addEventListener.bind(target),
        removeEventListener: target.removeEventListener.bind(target),
        setPointerCapture: (id: number) => {
          captureNativePointer(target, id);
        },
        releasePointerCapture: target.releasePointerCapture.bind(target),
      } as unknown as NativeCanvasInput,
      engineOptions: { msaaSamples: 4, clearColor: { r: 0.075, g: 0.12, b: 0.14, a: 1 } },
      diagnosticName: 'ak47-range',
      capture: {
        requested: String(NSProcessInfo.processInfo.environment.objectForKey('RANGE_CAPTURE_FRAME')) === '1',
        file: 'ak47-range-frame.png',
      },
      prepareScene: async (engine) => {
        haptics.resume();
        textures = new NativeCanvasTextures(engine.device);
        models = new NativeModels(engine.device);
        game = new RangeGame(engine, {
          loadModel: models.load,
          haptic: kind => haptics.impact(kind),
          safeInsets: () => {
            const insets = (canvas.nativeViewProtected as UIView).safeAreaInsets;
            return { top: insets.top, right: insets.right, bottom: insets.bottom, left: insets.left };
          },
          saveBackend: String(NSProcessInfo.processInfo.environment.objectForKey('RANGE_VERIFY')) === '1' ? new MemorySaveBackend() : new LocalStorageSaveBackend({ namespace: 'haiyue-games', storage: new NativeSettingsStorage() }),
          guiFont: { canvasFactory: textures.createCanvas2D, readAtlasPixels: textures.readAtlasPixels },
        });
        await game.init();
        if (String(NSProcessInfo.processInfo.environment.objectForKey('MOTION_VERIFY')) === '1') disposeMotionProbe = verifyNativeMotion(engine);
        if (verifying) void verifyNativeRange(game, target, canvas, () => haptics.snapshot()).finally(() => { verifying = false; game?.restart(); });
        return game.snapshot();
      },
      disposeScene() {
        disposeMotionProbe?.();
        haptics.dispose();
        game?.dispose();
        game = null;
        input.dispose();
        target.dispose();
        models?.dispose();
        textures?.dispose();
      },
      bindInput: () => ({
        suspend() {
          haptics.suspend();
          input.suspend();
          game?.cancelInteraction();
          void game?.flushSave();

        },
        resume() {
          haptics.resume();
          input.resume();
        },
        dispose() {
          input.dispose();
        },
        snapshot() {
          return { ...input.snapshot(), allTouches: target.snapshot(), haptics: haptics.snapshot(), game: game?.snapshot() };
        },
      }),
    },
  );
  Application.on(Application.uncaughtErrorEvent, unhandled);
  Application.on(Application.exitEvent, disposeHost);
}
export function onUnloaded(): void {
  if (!Application.inBackground && !Application.suspended) disposeHost();
}
function disposeHost(): void {
  Application.off(Application.uncaughtErrorEvent, unhandled);
  Application.off(Application.exitEvent, disposeHost);
  host?.dispose();
  host = null;
  activeCanvas = null;
}
