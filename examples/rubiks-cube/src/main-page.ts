import { Application, EventData, Label, Page } from '@nativescript/core';
import type { Canvas } from '@nativescript/canvas';
import { NativeRenderHost } from '../../../bridge/lifecycle/host';
import { NativeTouchInput } from '../../../bridge/input/native-touch.ios';
import type { NativeCanvasInput } from '../../../bridge/render/surface';
import { NativeCanvasTextures } from '../../../bridge/render/canvas-textures.ios';
import { LocalStorageSaveBackend } from '@haiyue/engine/save';
import { NativeSettingsStorage } from '../../../bridge/storage/settings-storage';
import { CubeGame } from '../../../../Games/games/rubiks-cube/CubeGame';
let host: NativeRenderHost | null = null;
let game: CubeGame | null = null;
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
  let textures: NativeCanvasTextures | null = null;
  const input = new NativeTouchInput(canvas, (sample) => {
    if (['cancel', 'suspend', 'unloaded', 'dispose'].includes(sample.action)) game?.cancelInteraction();
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
        addEventListener: input.target.addEventListener.bind(input.target),
        removeEventListener: input.target.removeEventListener.bind(input.target),
        setPointerCapture: (id: number) => {
          if (input.snapshot().primary === id) input.target.setPointerCapture(id);
        },
        releasePointerCapture: input.target.releasePointerCapture.bind(input.target),
      } as unknown as NativeCanvasInput,
      engineOptions: { msaaSamples: 4, clearColor: { r: 0.022, g: 0.037, b: 0.063, a: 1 } },
      diagnosticName: 'rubiks-cube',
      capture: {
        requested: String(NSProcessInfo.processInfo.environment.objectForKey('CUBE_CAPTURE_FRAME')) === '1',
        file: 'rubiks-cube-frame.png',
      },
      prepareScene: async (engine) => {
        textures = new NativeCanvasTextures(engine.device);
        game = new CubeGame(engine, {
          saveBackend: new LocalStorageSaveBackend({
            namespace: 'haiyue-games',
            storage: new NativeSettingsStorage(),
          }),
          guiFont: { canvasFactory: textures.createCanvas2D, readAtlasPixels: textures.readAtlasPixels },
        });
        await game.init();
        return game.snapshot();
      },
      disposeScene() {
        game?.dispose();
        game = null;
        input.dispose();
        textures?.dispose();
      },
      bindInput: () => ({
        suspend() {
          input.suspend();
          game?.cancelInteraction();
          void game?.flushSave();
        },
        resume() {
          input.resume();
        },
        dispose() {
          input.dispose();
        },
        snapshot() {
          return { ...input.snapshot(), game: game?.snapshot() };
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
