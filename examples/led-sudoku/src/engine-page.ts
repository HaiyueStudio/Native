import { Application, Color, Label, Screen, knownFolders, path, type EventData } from '@nativescript/core';
import { Canvas, ImageAsset } from '@nativescript/canvas';
import { LocalStorageSaveBackend } from '@haiyue/engine/save';
import { SudokuGui } from '../../../../Games/games/led-sudoku/engine-gui';
import { SudokuController } from '../../../../Games/games/led-sudoku/gui-controller';
import { SingleSlotGameSave } from '../../../../Games/games/save/SingleSlotGameSave';
import { DEFAULT_OPTIONS, isSaveData, type SaveData } from '../../../../Games/games/led-sudoku/rules';
import { THEMES } from '../../../../Games/games/led-sudoku/theme';
import { preferences } from '../../../../Games/games/led-sudoku/preferences';
import { NativeCanvasTextures } from '../../../bridge/render/canvas-textures';
import { NativeRenderHost } from '../../../bridge/lifecycle/host';
import { NativeTouchInput } from '../../../bridge/input/native-touch';
import { NativeEngineLaunchPage } from '../../../bridge/branding/launch-page';
import { NativeSettingsStorage } from '../../../bridge/storage/settings-storage';
import { nativeLaunchFlag } from '../../../bridge/lifecycle/launch-flags';
import type { NativeCanvasInput } from '../../../bridge/render/surface';
import { NativeGenerator, type GeneratorWorker } from './generator';
import { readPreferences, writePreferences } from './preferences';
import { isDevelopmentBuild } from './development';
import { captureDiagnostics } from './diagnostics';
import { runGuiSmoke } from './gui-smoke';
let active: EngineGame | null = null;
export function onLoaded(e: EventData) {
  if (active?.page === e.object) return;
  active?.dispose();
  active = new EngineGame(e.object as NativeEngineLaunchPage);
}
export function onUnloaded(e: EventData) {
  if (active?.page === e.object && !Application.inBackground && !Application.suspended) {
    active.dispose();
    active = null;
  }
}
export class EngineGame {
  readonly canvas = new Canvas();
  readonly input: NativeTouchInput;
  readonly controller: SudokuController;
  readonly save: SingleSlotGameSave<SaveData>;
  gui: SudokuGui | null = null;
  host: NativeRenderHost | null = null;
  private generator = new NativeGenerator(
    () => new Worker('./generator.worker') as unknown as GeneratorWorker,
  );
  private disposed = false;
  private suspended = false;
  private lastTick = Date.now();
  private timer: ReturnType<typeof setInterval>;
  private status = new Label();
  readonly smoke = isDevelopmentBuild() && (nativeLaunchFlag('LED_GUI_SMOKE') || nativeLaunchFlag('LED_SMOKE') || nativeLaunchFlag('LED_STAIRCASE_SMOKE'));
  constructor(readonly page: NativeEngineLaunchPage) {
    const pref = this.smoke ? preferences({}) : readPreferences();
    page.gameRoot.backgroundColor = new Color('#061015');
    page.gameRoot.addChild(this.canvas);
    this.canvas.ignoreTouchEvents = true;
    this.canvas.id = 'sudoku-gui';
    this.status.text = 'Haiyue GUI…';
    this.status.color = new Color('#83ffc1');
    this.status.verticalAlignment = 'middle';
    this.status.horizontalAlignment = 'center';
    page.gameRoot.addChild(this.status);
    this.save = new SingleSlotGameSave({
      gameId: 'led-sudoku',
      name: '流光数独自动存档',
      validateData: isSaveData,
      backend: new LocalStorageSaveBackend({
        namespace: this.smoke ? 'led-gui-smoke' : 'haiyue-games',
        storage: new NativeSettingsStorage(),
      }),
      onStatus: (s) => {
        if (s === 'error') {
          this.controller.status = this.controller.text('saveError');
          this.gui?.update(false);
        }
      },
    });
    this.controller = new SudokuController(
      {
        generate: (o, s) => this.generator.generate(o, s),
        save: (s) => {
          void this.save.save(s);
        },
        preferences: (p) => {
          if (!this.smoke) writePreferences(p);
        },
        changed: () => {
          const color = new Color(THEMES[this.controller.preferences.theme].background);
          this.page.backgroundColor = color;
          this.page.gameRoot.backgroundColor = color;
          this.gui?.update();
        },
      },
      pref,
    );
    this.input = new NativeTouchInput(this.canvas, () => this.requestFrame());
    this.canvas.on('ready', this.attach);
    Application.on(Application.exitEvent, this.exit);
    this.timer = setInterval(() => {
      const now = Date.now();
      if (!this.suspended) {
        this.controller.tick((now - this.lastTick) / 1000);
        this.gui?.updateClock();
      }
      this.lastTick = now;
    }, 1000);
  }
  readonly requestFrame = () => this.host?.requestFrame();
  private attach = () => {
    if (this.host || this.disposed) return;
    const target = this.input.target;
    this.host = new NativeRenderHost(
      this.canvas,
      (text) => {
        if (text.startsWith('原生 WebGPU 已呈现')) {
          this.status.visibility = 'collapse';
          this.page.splash.presented();
        } else if (text.includes('失败')) {
          this.status.text = text;
          this.status.visibility = 'visible';
          this.page.splash.fail(text);
        }
      },
      {
        canvasInput: {
          addEventListener: target.addEventListener.bind(target),
          removeEventListener: target.removeEventListener.bind(target),
          setPointerCapture: target.setPointerCapture.bind(target),
          releasePointerCapture: target.releasePointerCapture.bind(target),
        } as unknown as NativeCanvasInput,
        diagnosticName: 'led-sudoku',
        diagnosticIntervalFrames: 0,
        capture: { requested: this.smoke || nativeLaunchFlag('LED_CAPTURE'), file: 'led-sudoku-board.png' },
        engineOptions: { msaaSamples: 4, clearColor: { r: 0.02, g: 0.045, b: 0.065, a: 1 } },
        needsAnimationFrame: () => this.gui?.animating ?? false,
        prepareScene: async (engine) => {
          engine.devicePixelRatio = Math.min(Screen.mainScreen.scale, 2);
          const textures = new NativeCanvasTextures(engine.device);
          const icon = async (name: string) => {
            const image = new ImageAsset();
            await image.fromFile(path.join(knownFolders.currentApp().path, 'icons', name + '.png'));
            if (image.error) throw Error(image.error);
            const canvas = textures.createCanvas2D(96, 96);
            canvas.getContext('2d')!.drawImage(image as unknown as CanvasImageSource, 0, 0, 96, 96);
            return textures.textureFromCanvas(canvas, `icon-${name}`);
          };
          this.gui = new SudokuGui(
            engine,
            this.controller,
            {
              createCanvas2D: textures.createCanvas2D,
              readAtlasPixels: textures.readAtlasPixels,
              textureFromCanvas: textures.textureFromCanvas,
              icon,
              dispose: () => textures.dispose(),
            },
            this.requestFrame,
            () => ({
              width: this.canvas.clientWidth || engine.canvas!.clientWidth,
              height: this.canvas.clientHeight || engine.canvas!.clientHeight,
            }),
          );
          await this.gui.load();
          const saved = this.smoke ? null : await this.save.load();
          if (saved) this.controller.restore(saved);
          else await this.controller.newGame(DEFAULT_OPTIONS, this.smoke ? 39 : undefined);
          this.gui.update();
          return this.snapshot();
        },
        bindInput: (_engine, report) => {
          if (this.smoke) setTimeout(() => void runGuiSmoke(this, report), 1200);
          else if (nativeLaunchFlag('LED_CAPTURE'))
            setTimeout(() => {
              report('gui-ready', this.snapshot());
              captureDiagnostics(this.page);
            }, 2000);
          return {
            suspend: () => {
              this.suspended = true;
              this.gui?.cancel();
              this.input.suspend();
              void this.flush();
            },
            resume: () => {
              this.suspended = false;
              this.lastTick = Date.now();
              this.input.resume();
              this.gui?.update();
            },
            dispose: () => this.input.dispose(),
            snapshot: () => ({ input: this.input.snapshot(), game: this.snapshot() }),
          };
        },
        disposeScene: () => this.gui?.dispose(),
      },
    );
  };
  snapshot() {
    return {
      ...this.gui?.snapshot(),
      seed: this.controller.session.state?.puzzle.seed,
      filled: this.controller.session.state?.board.filter(Boolean).length,
      complete: this.controller.session.done,
      preferences: this.controller.preferences,
    };
  }
  async flush() {
    const s = this.controller.session.snapshot();
    if (s) this.save.save(s);
    await this.save.flush();
  }
  private exit = () => {
    void this.flush();
  };
  dispose() {
    if (this.disposed) return;
    void this.flush();
    this.disposed = true;
    clearInterval(this.timer);
    Application.off(Application.exitEvent, this.exit);
    this.canvas.off('ready', this.attach);
    this.controller.dispose();
    this.generator.dispose();
    this.host?.dispose();
    this.page.splash.dispose();
  }
}
