import { PresentationPause } from './presentation-pause';
import { Application, File, knownFolders, path, isAndroid } from '@nativescript/core';
import type { Canvas } from '@nativescript/canvas';
import { HaiyueEngine } from '@haiyue/engine';
import { getEngineDiagnosticsSnapshot } from '@haiyue/engine/diagnostics';
import { FramePerformance } from './frame-performance';
import { NativeDemandFrames } from './demand-frames';
import { NativeSurface, NativeSurfaceUnavailableError, type NativeCanvasInput } from '../render/surface';
import { captureSurfaceFrame, isFrameCaptureRequested } from '../render/frame-capture';
import { nativeFrames, installNativeFrameRuntime } from './runtime';

export interface NativeHostInput {
  suspend(): void;
  resume(): void;
  dispose(): void;
  snapshot(): unknown;
}

export interface NativeRenderHostOptions {
  /** Opt-in demand rendering. Call requestFrame() for input/async changes. */
  needsAnimationFrame?: () => boolean;
  performance?: boolean;
  /** Zero disables periodic snapshots/writes; lifecycle and errors remain logged. */
  diagnosticIntervalFrames?: number;
  canvasInput?: NativeCanvasInput;
  engineOptions?: Pick<ConstructorParameters<typeof HaiyueEngine>[0], 'clearColor' | 'renderProfile' | 'msaaSamples' | 'reverseZ' | 'diagnostics'>;
  bindInput?: (engine: HaiyueEngine, report: (event: string, detail: unknown) => void) => NativeHostInput;
  prepareScene?: (engine: HaiyueEngine) => unknown | Promise<unknown>;
  disposeScene?: () => void;
  diagnosticName?: string;
  capture?: { requested: boolean; file: string };
}

export class NativeRenderHost {
  private engine: HaiyueEngine | null = null;
  private surface: NativeSurface;
  private initializing = false;
  private disposed = false;
  private suspended = false;
  private readonly presentationPause = new PresentationPause(() => this.suspend(), () => this.resume());
  private readonly appSuspend = () => this.presentationPause.setBackground(true);
  private readonly appResume = () => this.presentationPause.setBackground(false);
  /** Stops frames, audio and input until BOTH the presentation and background suspension end. */
  pausePresentation(): () => void { return this.disposed ? () => {} : this.presentationPause.acquire(); }
  /** Present the disabled/loading UI once before stopping the demand renderer. */
  preparePresentation(): Promise<() => void> {
    const engine = this.engine;
    if (!engine || engine.state !== 'ready' || this.suspended || this.disposed) return Promise.resolve(this.pausePresentation());
    return new Promise(resolve => {
      let complete = false;
      const finish = () => {
        if (complete) return;
        complete = true; clearTimeout(timeout); engine.off('after-update', finish);
        resolve(this.pausePresentation());
      };
      const timeout = setTimeout(finish, 150);
      engine.on('after-update', finish); this.requestFrame();
    });
  }
  private surfaceRetry: ReturnType<typeof setTimeout> | null = null;
  private surfaceMisses = 0;
  private surfaceInputPaused = false;
  private surfacePause: (() => void) | null = null;
  private layoutPause: (() => void) | null = null;
  private readonly surfaceDestroyed = (): void => {
    if (!this.disposed && !this.failed && !this.surfacePause) this.surfacePause = this.presentationPause.acquire();
  };
  private readonly surfaceCreated = (): void => {
    const release = this.surfacePause;
    this.surfacePause = null;
    release?.();
  };
  private failed = false;
  private generation = 0;
  private input: NativeHostInput | null = null;
  private sceneDisposed = false;
  private resumeCount = 0;
  private observedDevice: GPUDevice | null = null;
  private captureRequested: boolean;
  private readonly journal: string[] = [];
  private readonly logFile: File;
  private readonly performance = new FramePerformance();
  private readonly demand: NativeDemandFrames | null;

  constructor(private readonly view: Canvas, private readonly status: (text: string) => void, private readonly options: NativeRenderHostOptions = {}) {
    this.captureRequested = options.capture?.requested ?? isFrameCaptureRequested();
    this.demand = options.needsAnimationFrame ? new NativeDemandFrames({
      start: () => { try { this.engine?.run(); } catch (error) { this.fail(error); } },
      stop: () => this.engine?.stop(),
      defer: callback => { void Promise.resolve().then(callback); },
    }) : null;
    this.logFile = File.fromPath(path.join(knownFolders.documents().path, `${options.diagnosticName ?? 'g02'}-host.jsonl`));
    this.surface = new NativeSurface(view, this.report, options.canvasInput);
    installNativeFrameRuntime(error => this.fail(error));
    Application.on(Application.suspendEvent, this.appSuspend);
    Application.on(Application.resumeEvent, this.appResume);
    view.on('layoutChanged', this.layout);
    view.on('surfaceDestroyed', this.surfaceDestroyed);
    view.on('surfaceCreated', this.surfaceCreated);
    this.report('host-created', { engine: '0.1.0', canvas: '2.1.18', runtime: '9.0.3', backendRoute: isAndroid ? 'Canvas/wgpu/Vulkan' : 'Canvas/wgpu/Metal', dpr: this.surface.pixelRatio, captureRequested: this.captureRequested });
    this.layout();
  }

  private readonly report = (event: string, detail: unknown): void => {
    const record = JSON.stringify({ time: Date.now(), event, detail });
    console.log(`[${this.options.diagnosticName ?? 'g02'}] ${record}`);
    this.journal.push(record);
    if (this.journal.length > 200) this.journal.splice(1, 1);
    try { this.logFile.writeTextSync(this.journal.join('\n') + '\n'); }
    catch (error) { console.error('[G02] Failed to persist diagnostic journal', error); }
  };

  private readonly layout = (): void => {
    if (this.disposed || this.failed) return;
    if (!this.surface.hasLayout) {
      if (this.engine && !this.layoutPause) this.layoutPause = this.presentationPause.acquire();
      return;
    }
    if (this.layoutPause) {
      const release = this.layoutPause; this.layoutPause = null; release(); return;
    }
    if (this.suspended || this.surfaceRetry !== null) return;
    if (!this.engine) { void this.initialize(); return; }
    if (this.engine.state === 'ready') {
      try { this.engine.resizeToDisplaySize(); this.requestFrame(); } catch (error) { this.fail(error); }
    }
  };

  private async initialize(): Promise<void> {
    if (this.initializing || this.disposed || this.failed) return;
    this.initializing = true;
    const generation = ++this.generation;
    this.status('正在初始化原生 WebGPU…');
    try {
      const engine = new HaiyueEngine({ ...this.surface.engineOptions(), renderProfile: 'simple', msaaSamples: 1, timestampQuery: false, diagnostics:{enabled:this.options.performance===true}, recoverDeviceLost: false, clearColor: { r: 0.025, g: 0.055, b: 0.095, a: 1 }, ...this.options.engineOptions });
      this.engine = engine;
      await engine.init();
      if (this.disposed || this.failed || generation !== this.generation) { engine.destroy(); return; }
      this.observedDevice = engine.device;
      this.observedDevice.addEventListener('uncapturederror', this.onGpuError);
      engine.on('update',this.beforeFrame);
      engine.on('device-lost', event => this.fail(new Error(`WebGPU device lost: ${event.detail?.message}`)));
      if (this.options.prepareScene) this.report('scene-ready', await this.options.prepareScene(engine));
      else engine.switchScene(engine.createScene({ render3D: true, view: { clearColor: engine.clearColor } }));
      if (this.disposed || this.failed || generation !== this.generation) { engine.destroy(); return; }
      this.input = this.options.bindInput?.(engine, this.report) ?? null;
      if (this.suspended) this.input?.suspend();
      this.report('input-ready', this.input?.snapshot() ?? null);
      engine.on('after-update', this.afterFrame);
      this.report('engine-ready', { width: engine.width, height: engine.height, format: engine.format, profile: engine.renderProfile, clearColor: engine.clearColor });
      if (!this.suspended) { if (this.demand) this.demand.resume(); else engine.run(); }
    } catch (error) { if (!this.disposed) this.fail(error); }
    finally {
      this.initializing = false;
      if (this.failed) void this.releaseFailedEngine();
    }
  }

  private readonly afterFrame = (): void => {
    if (this.failed || this.disposed || this.suspended) return;
    if (this.captureRequested && this.surface.presentedFrames === 119) {
      this.captureRequested = false;
      try { this.report('frame-capture', { ...captureSurfaceFrame(this.view, this.options.capture?.file), frame: 120 }); }
      catch (error) { this.report('capture-error', { message: String(error) }); }
    }
    if (!this.surface.present()) { this.finishDemandFrame(); return; }
    if (this.surfaceMisses) {
      this.report('surface-recovered', { attempts: this.surfaceMisses, frames: this.surface.presentedFrames });
      this.surfaceMisses = 0;
    }
    if(this.options.performance)this.performance.end(performance.now());
    const frames = this.surface.presentedFrames;
    const interval = this.options.diagnosticIntervalFrames ?? 120;
    if (frames === 1 || (interval > 0 && frames % interval === 0)) {
      this.status(`原生 WebGPU 已呈现 ${frames} 帧`);
      this.report('present', { frames, width: this.engine?.width, height: this.engine?.height, scheduledCallbacks: nativeFrames.pendingCount, input: this.input?.snapshot() ?? null });
      if(this.options.performance && this.engine)this.report('performance',{frames,...this.performance.take(),thermalState:isAndroid ? null : NSProcessInfo.processInfo.thermalState,engine:getEngineDiagnosticsSnapshot(this.engine)});
    }
    this.finishDemandFrame();
  };

  requestFrame(): void { this.demand?.request(); }
  renderingSnapshot() {
    return { frames: this.surface.presentedFrames, scheduledCallbacks: nativeFrames.pendingCount, demand: this.demand?.snapshot() ?? null };
  }
  private finishDemandFrame(): void {
    this.demand?.afterFrame(this.captureRequested || this.options.needsAnimationFrame?.() === true);
  }

  private readonly beforeFrame = ():void => {
    if (this.options.performance) this.performance.begin(performance.now());
    this.surface.beginFrame();
    if (this.surfaceInputPaused) { this.surfaceInputPaused = false; this.input?.resume(); }
  };

  private cancelSurfaceRetry(): void {
    if (this.surfaceRetry !== null) clearTimeout(this.surfaceRetry);
    this.surfaceRetry = null;
  }

  private retrySurface(): void {
    if (this.suspended || this.surfaceRetry !== null) return;
    if (++this.surfaceMisses > 8) { this.fail(new Error('Native surface remained unavailable after 8 retries.')); return; }
    this.demand?.suspend();
    this.engine?.stop();
    nativeFrames.cancelAll();
    if (!this.surfaceInputPaused) { this.surfaceInputPaused = true; this.input?.suspend(); }
    this.performance.reset();
    this.report('surface-wait', { attempt: this.surfaceMisses });
    // Never restart inside the failing RAF. Backoff avoids hot-looping a lost surface.
    this.surfaceRetry = setTimeout(() => {
      this.surfaceRetry = null;
      if (this.disposed || this.failed || this.suspended || this.engine?.state !== 'ready') return;
      try {
        if (!this.surface.hasLayout) { this.layout(); return; }
        this.engine.resizeToDisplaySize();
        this.surface.reconfigure();
        if (this.demand) this.demand.resume(); else this.engine.run();
      } catch (error) { this.fail(error); }
    }, Math.min(50 * 2 ** (this.surfaceMisses - 1), 400));
  }

  private readonly suspend = (): void => {
    this.cancelSurfaceRetry();
    this.surfaceMisses = 0;
    this.performance.reset();
    this.suspended = true;
    this.demand?.suspend();
    this.input?.suspend();
    this.engine?.stop();
    nativeFrames.cancelAll();
    this.report('suspend', { frames: this.surface.presentedFrames, scheduledCallbacks: nativeFrames.pendingCount, input: this.input?.snapshot() ?? null });
  };

  private readonly resume = (): void => {
    if (this.disposed || this.failed || !this.suspended) return;
    this.suspended = false;
    try {
      this.layout();
      if (this.suspended) return;
      if (this.engine?.state === 'ready' && !this.initializing) {
        this.engine.resizeToDisplaySize(true);
        this.surface.reconfigure();
        this.input?.resume();
        this.surfaceInputPaused = false;
        if (this.demand) this.demand.resume(); else this.engine.run();
      }
    } catch (error) { this.fail(error); return; }
    this.report('resume', { count: ++this.resumeCount, frames: this.surface.presentedFrames, scheduledCallbacks: nativeFrames.pendingCount, input: this.input?.snapshot() ?? null });
  };

  fail(error: unknown): void {
    if (this.disposed || this.failed) return;
    if (error instanceof NativeSurfaceUnavailableError && this.engine?.state === 'ready' && !this.initializing) {
      this.retrySurface(); return;
    }
    this.failed = true;
    this.cancelSurfaceRetry();
    this.demand?.suspend();
    this.input?.suspend();
    this.engine?.stop();
    nativeFrames.cancelAll();
    const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
    this.status(`初始化或渲染失败\n${message}`);
    this.report('error', { message });
    if (!this.initializing) void this.releaseFailedEngine();
  }

  private readonly onGpuError = (event: GPUUncapturedErrorEvent): void => this.fail(event.error);

  private removeDeviceListener(): void {
    this.engine?.off('update',this.beforeFrame);
    this.observedDevice?.removeEventListener('uncapturederror', this.onGpuError);
    this.observedDevice = null;
  }

  private async releaseFailedEngine(): Promise<void> {
    const engine = this.engine;
    if (!engine) return;
    // Yield past the current render callback and any Engine device-loss cleanup.
    try { await engine.waitForRecovery(); }
    catch (error) { this.report('recovery-cleanup-error', { message: String(error) }); }
    try {
      this.disposeInput();
      this.disposeScene();
      this.removeDeviceListener();
      engine.destroy();
      if (this.engine === engine) this.engine = null;
      this.report('failure-cleanup', { state: engine.state, scheduledCallbacks: nativeFrames.pendingCount });
    } catch (error) {
      this.report('cleanup-error', { message: String(error) });
    } finally {
      try { this.surface.release(); }
      catch (error) { this.report('surface-cleanup-error', { message: String(error) }); }
    }
  }

  private disposeInput(): void {
    if (!this.input) return;
    this.input.dispose();
    this.report('input-disposed', this.input.snapshot());
    this.input = null;
  }

  private disposeScene(): void {
    if (this.sceneDisposed) return;
    this.sceneDisposed = true;
    this.options.disposeScene?.();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelSurfaceRetry();
    this.demand?.dispose();
    ++this.generation;
    this.disposeInput();
    this.disposeScene();
    Application.off(Application.suspendEvent, this.appSuspend);
    Application.off(Application.resumeEvent, this.appResume);
    this.view.off('layoutChanged', this.layout);
    this.view.off('surfaceDestroyed', this.surfaceDestroyed);
    this.view.off('surfaceCreated', this.surfaceCreated);
    nativeFrames.cancelAll();
    this.removeDeviceListener();
    this.engine?.destroy();
    this.engine = null;
    this.report('disposed', { frames: this.surface.presentedFrames, scheduledCallbacks: nativeFrames.pendingCount, input: null });
  }
}
