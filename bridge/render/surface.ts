import { Screen, isAndroid } from '@nativescript/core';
import { Canvas, GPU, GPUAdapter, GPUCanvasContext } from '@nativescript/canvas';
import type { HaiyueEngine } from '@haiyue/engine';
import { nativeViewRect } from './view-rect';
import { copyDeviceDescriptor } from './device-descriptor';
import { installNativeWebGpuConstants } from './webgpu-constants';

type EngineOptions = ConstructorParameters<typeof HaiyueEngine>[0];
export type NativeCanvasInput = Pick<HTMLCanvasElement, 'addEventListener' | 'removeEventListener' | 'setPointerCapture' | 'releasePointerCapture'>;

export class NativeSurface {
  readonly pixelRatio = Math.min(Screen.mainScreen.scale, 2);
  readonly gpu = new GPU();
  private adapter: GPUAdapter | null = null;
  private context: GPUCanvasContext | null = null;
  private acquired = false;
  presentedFrames = 0;

  constructor(readonly view: Canvas, private readonly report: (event: string, detail: unknown) => void, private readonly input?: NativeCanvasInput) {
    // Canvas.getContext('webgpu') uses this entry point internally, even when
    // Engine receives its own injected provider. Use the same native GPU.
    installNativeWebGpuConstants();
    const navigatorObject = globalThis.navigator ?? {};
    if (!globalThis.navigator) Object.defineProperty(globalThis, 'navigator', { value: navigatorObject, configurable: true });
    Object.defineProperty(navigatorObject, 'gpu', { value: this.gpu, configurable: true });
  }

  readonly provider = {
    requestAdapter: async (options?: GPURequestAdapterOptions) => {
      if (options?.featureLevel && options.featureLevel !== 'core' && options.featureLevel !== 'compatibility') {
        throw new Error(`Unsupported WebGPU feature level: ${options.featureLevel}`);
      }
      this.adapter = await this.gpu.requestAdapter({ powerPreference: options?.powerPreference, isFallbackAdapter: options?.forceFallbackAdapter, featureLevel: options?.featureLevel as 'core' | 'compatibility' | undefined });
      if (!this.adapter) throw new Error('Native WebGPU returned no adapter.');
      const info = await this.adapter.requestAdapterInfo();
      this.report('adapter', { vendor: info?.vendor, architecture: info?.architecture, device: info?.device, description: info?.description, features: [...this.adapter.features] });
      const adapter = this.adapter;
      return {
        features: adapter.features,
        limits: adapter.limits,
        isFallbackAdapter: adapter.isFallbackAdapter,
        requestAdapterInfo: () => adapter.requestAdapterInfo(),
        requestDevice: (descriptor?: GPUDeviceDescriptor) => adapter.requestDevice(
          copyDeviceDescriptor(descriptor) as unknown as Parameters<GPUAdapter['requestDevice']>[0],
        ),
      };
    },
    getPreferredCanvasFormat: () => this.gpu.getPreferredCanvasFormat(),
  };

  get hasLayout(): boolean { return nativeViewRect(this.view).width > 0 && nativeViewRect(this.view).height > 0; }

  engineOptions(): Pick<EngineOptions, 'canvas' | 'gpu' | 'devicePixelRatio'> {
    const self = this;
    const context = {
      configure(options: GPUCanvasConfiguration): void {
        const native = self.getContext();
        if (!self.adapter) throw new Error('Cannot configure surface before adapter acquisition.');
        const caps = native.getCapabilities(self.adapter);
        if (!(caps.format as readonly string[]).includes(options.format)) throw new Error(`Surface does not support ${options.format}.`);
        self.report('surface-configure', { format: options.format, capabilities: caps });
        native.configure(options as unknown as Parameters<GPUCanvasContext['configure']>[0]);
      },
      unconfigure(): void { self.release(); },
      getCurrentTexture(): GPUTexture {
        const texture = self.getContext().getCurrentTexture();
        if (!texture) throw new Error('Native surface returned an empty current texture.');
        self.acquired = true;
        return texture as unknown as GPUTexture;
      },
    };
    const canvas = {
      focus: () => isAndroid ? (self.view.nativeViewProtected as android.view.View | undefined)?.requestFocus() : (self.view.nativeViewProtected as UIView | undefined)?.becomeFirstResponder(),
      addEventListener: (...args: Parameters<NativeCanvasInput['addEventListener']>) => self.input?.addEventListener(...args),
      removeEventListener: (...args: Parameters<NativeCanvasInput['removeEventListener']>) => self.input?.removeEventListener(...args),
      setPointerCapture: (id: number) => self.input?.setPointerCapture(id),
      releasePointerCapture: (id: number) => self.input?.releasePointerCapture(id),
      get width() { return self.view.width; },
      set width(value: number) { self.view.width = value; },
      get height() { return self.view.height; },
      set height(value: number) { self.view.height = value; },
      get clientWidth() { return nativeViewRect(self.view).width; },
      get clientHeight() { return nativeViewRect(self.view).height; },
      getBoundingClientRect() { return nativeViewRect(self.view); },
      getContext(type: string) { return type === 'webgpu' ? context : null; },
    };
    // These are the two audited structural boundaries. Engine has a browser
    // canvas type, but its render path only uses the members supplied above.
    return { canvas: canvas as unknown as EngineOptions['canvas'], gpu: this.provider as unknown as EngineOptions['gpu'], devicePixelRatio: this.pixelRatio };
  }

  present(): boolean {
    if (!this.acquired) return false;
    this.getContext().presentSurface();
    this.acquired = false;
    this.presentedFrames++;
    return true;
  }

  /** Finish an interrupted acquired frame before releasing the surface. */
  release(): void {
    try {
      if (this.acquired) {
        this.acquired = false;
        // Canvas releases its per-frame native texture/view handles at present.
        // An interrupted frame is never counted as a successful Engine frame.
        this.context?.presentSurface();
      }
    } finally {
      this.context?.unconfigure();
    }
  }

  private getContext(): GPUCanvasContext {
    if (!this.context) this.context = this.view.getContext('webgpu');
    if (!this.context) throw new Error('Native Canvas WebGPU context is unavailable.');
    return this.context;
  }
}
