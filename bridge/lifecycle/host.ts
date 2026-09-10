import { Application, File, knownFolders, path } from '@nativescript/core';
import type { Canvas } from '@nativescript/canvas';
import { HaiyueEngine } from '@haiyue/engine';
import { NativeSurface, type NativeCanvasInput } from '../render/surface';
import { captureSurfaceFrame, isFrameCaptureRequested } from '../render/frame-capture.ios';
import { nativeFrames, installNativeFrameRuntime } from './runtime';

export interface NativeHostInput {
  suspend(): void;
  resume(): void;
  dispose(): void;
  snapshot(): unknown;
}

export interface NativeRenderHostOptions {
  canvasInput?: NativeCanvasInput;
  engineOptions?: Pick<ConstructorParameters<typeof HaiyueEngine>[0], 'clearColor' | 'renderProfile' | 'msaaSamples'>;
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
  private failed = false;
  private generation = 0;
  private input: NativeHostInput | null = null;
  private sceneDisposed = false;
  private resumeCount = 0;
  private observedDevice: GPUDevice | null = null;
  private captureRequested: boolean;
  private readonly journal: string[] = [];
  private readonly logFile: File;

  constructor(private readonly view: Canvas, private readonly status: (text: string) => void, private readonly options: NativeRenderHostOptions = {}) {
    this.captureRequested = options.capture?.requested ?? isFrameCaptureRequested();
    this.logFile = File.fromPath(path.join(knownFolders.documents().path, `${options.diagnosticName ?? 'g02'}-host.jsonl`));
    this.surface = new NativeSurface(view, this.report, options.canvasInput);
    installNativeFrameRuntime(error => this.fail(error));
    Application.on(Application.suspendEvent, this.suspend);
    Application.on(Application.resumeEvent, this.resume);
    view.on('layoutChanged', this.layout);
    this.report('host-created', { engine: '0.1.0', canvas: '2.1.18', runtime: '9.0.3', backendRoute: 'Canvas/wgpu/Metal', dpr: this.surface.pixelRatio, captureRequested: this.captureRequested });
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
    if (this.disposed || this.failed || this.suspended || !this.surface.hasLayout) return;
    if (!this.engine) { void this.initialize(); return; }
    if (this.engine.state === 'ready') {
      try { this.engine.resizeToDisplaySize(); } catch (error) { this.fail(error); }
    }
  };

  private async initialize(): Promise<void> {
    if (this.initializing || this.disposed || this.failed) return;
    this.initializing = true;
    const generation = ++this.generation;
    this.status('正在初始化原生 WebGPU…');
    try {
      const engine = new HaiyueEngine({ ...this.surface.engineOptions(), renderProfile: 'simple', msaaSamples: 1, timestampQuery: false, recoverDeviceLost: false, clearColor: { r: 0.025, g: 0.055, b: 0.095, a: 1 }, ...this.options.engineOptions });
      this.engine = engine;
      await engine.init();
      if (this.disposed || this.failed || generation !== this.generation) { engine.destroy(); return; }
      this.observedDevice = engine.device;
      this.observedDevice.addEventListener('uncapturederror', this.onGpuError);
      engine.on('device-lost', event => this.fail(new Error(`WebGPU device lost: ${event.detail?.message}`)));
      if (this.options.prepareScene) this.report('scene-ready', await this.options.prepareScene(engine));
      else engine.switchScene(engine.createScene({ render3D: true, view: { clearColor: engine.clearColor } }));
      if (this.disposed || this.failed || generation !== this.generation) { engine.destroy(); return; }
      this.input = this.options.bindInput?.(engine, this.report) ?? null;
      if (this.suspended) this.input?.suspend();
      this.report('input-ready', this.input?.snapshot() ?? null);
      engine.on('after-update', this.afterFrame);
      this.report('engine-ready', { width: engine.width, height: engine.height, format: engine.format, profile: engine.renderProfile, clearColor: engine.clearColor });
      if (!this.suspended) engine.run();
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
    if (!this.surface.present()) return;
    const frames = this.surface.presentedFrames;
    if (frames === 1 || frames % 120 === 0) {
      this.status(`原生 WebGPU 已呈现 ${frames} 帧`);
      this.report('present', { frames, width: this.engine?.width, height: this.engine?.height, scheduledCallbacks: nativeFrames.pendingCount, input: this.input?.snapshot() ?? null });
    }
  };

  private readonly suspend = (): void => {
    this.suspended = true;
    this.input?.suspend();
    this.engine?.stop();
    nativeFrames.cancelAll();
    this.report('suspend', { frames: this.surface.presentedFrames, scheduledCallbacks: nativeFrames.pendingCount, input: this.input?.snapshot() ?? null });
  };

  private readonly resume = (): void => {
    if (this.disposed || this.failed || !this.suspended) return;
    this.suspended = false;
    this.layout();
    if (this.engine?.state === 'ready') {
      this.engine.resizeToDisplaySize(true);
      this.input?.resume();
      this.engine.run();
    }
    this.report('resume', { count: ++this.resumeCount, frames: this.surface.presentedFrames, scheduledCallbacks: nativeFrames.pendingCount, input: this.input?.snapshot() ?? null });
  };

  fail(error: unknown): void {
    if (this.disposed || this.failed) return;
    this.failed = true;
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
    ++this.generation;
    this.disposeInput();
    this.disposeScene();
    Application.off(Application.suspendEvent, this.suspend);
    Application.off(Application.resumeEvent, this.resume);
    this.view.off('layoutChanged', this.layout);
    nativeFrames.cancelAll();
    this.removeDeviceListener();
    this.engine?.destroy();
    this.engine = null;
    this.report('disposed', { frames: this.surface.presentedFrames, scheduledCallbacks: nativeFrames.pendingCount, input: null });
  }
}
