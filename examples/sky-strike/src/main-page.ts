import { SkyStrikeLocale } from '../../../../Games/games/sky-strike/i18n';
import { Application, File, knownFolders, path, type EventData, type Page, type Label } from '@nativescript/core';
import { type Canvas } from '@nativescript/canvas';
import { World } from '@haiyue/engine';
import { RenderIntegration } from '@haiyue/engine/experimental';
import { LocalStorageSaveBackend } from '@haiyue/engine/save';
import type { NativeCanvasInput } from '../../../bridge/render/surface';
import { NativeRenderHost } from '../../../bridge/lifecycle/host';
import { NativeTouchInput } from '../../../bridge/input/native-touch.ios';
import { NativeCanvasTextures } from '../../../bridge/render/canvas-textures.ios';
import { NativeSettingsStorage } from '../../../bridge/storage/settings-storage';
import { SkyStrikeGame } from '../../../../Games/games/sky-strike/SkyStrikeGame';
import { SkyStrikeBattleLayer, unpackSkySprites } from '../../../../Games/games/sky-strike/battleLayer';
import { SkyStrikeGuiHud } from '../../../../Games/games/sky-strike/guiHud';
import { loadSkyStrikeLevels } from '../../../../Games/games/sky-strike/levels/loader';

let host: NativeRenderHost | null = null;
let activeCanvas: Canvas | null = null;
const ready = new WeakSet<Canvas>();
export function onCanvasReady(args: EventData): void { const canvas = args.object as Canvas; ready.add(canvas); ensureHost(canvas); }
export function onLoaded(args: EventData): void { const canvas = (args.object as Page).getViewById<Canvas>('surface'); if (canvas && ready.has(canvas)) ensureHost(canvas); }
function unhandled(args: { error?: unknown }): void { host?.fail(args.error); }
function ensureHost(canvas: Canvas): void {
  if (host && activeCanvas !== canvas) disposeHost();
  if (host) return;
  activeCanvas = canvas;
  const locale = new SkyStrikeLocale(new NativeSettingsStorage());
  const status = (canvas.page as Page).getViewById<Label>('status');
  const input = new NativeTouchInput(canvas, () => {});
  let game: SkyStrikeGame | null = null;
  let world: World | null = null;
  let textures: NativeCanvasTextures | null = null;
  let detachUpdate = () => {};
  host = new NativeRenderHost(canvas, text => {
    status.visibility = text.startsWith('原生 WebGPU 已呈现') ? 'collapse' : 'visible';
    status.text = locale.text(text.startsWith('正在初始化') ? 'preparing' : 'startupFailed');
  }, {
    diagnosticName: 'sky-strike',
    engineOptions: { msaaSamples: 4, clearColor: { r: 0.004, g: 0.008, b: 0.03, a: 1 } },
    canvasInput: {
      addEventListener: input.target.addEventListener.bind(input.target),
      removeEventListener: input.target.removeEventListener.bind(input.target),
      setPointerCapture: (id: number) => { if (input.snapshot().primary === id) input.target.setPointerCapture(id); },
      releasePointerCapture: input.target.releasePointerCapture.bind(input.target),
    } as unknown as NativeCanvasInput,
    capture: { requested: String(NSProcessInfo.processInfo.environment.objectForKey('SKY_CAPTURE_FRAME')) === '1', file: 'sky-strike-frame.png' },
    async prepareScene(engine) {
      const surface = engine.canvas!;
      textures = new NativeCanvasTextures(engine.device); // GUI font atlas only, built once.
      const assetsRoot = path.join(knownFolders.currentApp().path, 'game-assets');
      const entries = JSON.parse(File.fromPath(path.join(assetsRoot, 'assets/sprites.json')).readTextSync());
      const data = NSData.dataWithContentsOfFile(path.join(assetsRoot, 'assets/sprites.rgba'));
      if (!data) throw new Error('Bundled sprite pack is missing.');
      const bytes = new Uint8Array(interop.bufferFromData(data));
      world = new World('Sky Strike Native');
      const battle = new SkyStrikeBattleLayer(engine, unpackSkySprites(entries, bytes)); world.addSystem(battle);
      const nativeInsets = (canvas.nativeViewProtected as UIView).safeAreaInsets;
      const insets = { top: nativeInsets.top, bottom: nativeInsets.bottom };
      const ui = new SkyStrikeGuiHud(world, id => battle.guiImage(id), insets, locale);
      const levels = await loadSkyStrikeLevels(async source => JSON.parse(File.fromPath(path.join(assetsRoot, source)).readTextSync()));
      game = new SkyStrikeGame(surface, battle, engine, world, {
        ui, locale, levels, keyboard: false, guiLoadOp: 'load',
        acceptsGameplayInput: (_x, y) => y >= insets.top + 94 && y <= surface.getBoundingClientRect().height - insets.bottom - 94,
        saveBackend: new LocalStorageSaveBackend({ namespace: 'haiyue-games', storage: new NativeSettingsStorage() }),
        guiFont: { canvasFactory: textures.createCanvas2D, readAtlasPixels: textures.readAtlasPixels },

      });
      await game.init();
      const integration = new RenderIntegration(engine, { label: 'SkyStrike.native' });
      world.addRuntimeIntegration(integration); integration.registerAll(world);
      const update = ({ detail: { time, delta } }: { detail: { time: number; delta: number } }) => {
        game!.update(delta);
        world!.update(time, delta);
      };
      engine.on('update', update); detachUpdate = () => engine.off('update', update);
      return { ...game.snapshot(), bundledImages: entries.length, levels: levels.length, textures: textures.snapshot() };
    },
    bindInput() { return {
      suspend() { input.suspend(); game?.suspend(); }, resume() { input.resume(); },
      dispose() { input.dispose(); }, snapshot() { return { ...input.snapshot(), game: game?.snapshot(), textures: textures?.snapshot() }; },
    }; },
    disposeScene() { detachUpdate(); input.dispose(); game?.dispose(); world?.destroy(); textures?.dispose();  },
  });
  Application.on(Application.uncaughtErrorEvent, unhandled); Application.on(Application.exitEvent, disposeHost);
}
export function onUnloaded(): void { if (!Application.inBackground && !Application.suspended) disposeHost(); }
function disposeHost(): void { Application.off(Application.uncaughtErrorEvent, unhandled); Application.off(Application.exitEvent, disposeHost); host?.dispose(); host = null; activeCanvas = null; }
