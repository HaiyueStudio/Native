import { SurfaceLease } from './surface';
/** Native window/event ownership. All GLFW and WebGPU surface calls stay on Deno's main thread. */
export class GlfwWindow {
  readonly canvas: any;
  readonly surface: Deno.UnsafeWindowSurface;
  private readonly lib: { symbols: Record<string, (...args: any[]) => any>; close(): void };
  private readonly handle: Deno.PointerValue;
  private readonly callbacks: Deno.UnsafeCallback<any>[] = [];
  private readonly listeners = new Map<string, Set<(event: any) => void>>();
  private readonly keys = new Set<string>();
  private readonly sizes = new Int32Array(4);
  private readonly position = new Float64Array(2);
  private readonly pad = new Uint8Array(40);
  private lastPad = '';
  private buttons = 0;
  private disposed = false;
  private readonly lease: SurfaceLease;
  private callbackError: unknown = null;
  private fullscreen = false;
  private windowed = new Int32Array(4);
  private readonly context: GPUCanvasContext;
  width = 1; height = 1; pixelWidth = 1; pixelHeight = 1; focused = true;

  constructor(library: string, options: { title: string; width: number; height: number }) {
    const os = Deno.build.os;
    if (os !== 'darwin' && os !== 'windows') throw new Error(`Unsupported desktop OS: ${os}`);
    this.lib = Deno.dlopen(library, {
      glfwInit: { parameters: [], result: 'i32' }, glfwTerminate: { parameters: [], result: 'void' },
      glfwWindowHint: { parameters: ['i32', 'i32'], result: 'void' },
      glfwCreateWindow: { parameters: ['i32', 'i32', 'buffer', 'pointer', 'pointer'], result: 'pointer' },
      glfwDestroyWindow: { parameters: ['pointer'], result: 'void' },
      glfwWindowShouldClose: { parameters: ['pointer'], result: 'i32' },
      glfwSetWindowShouldClose: { parameters: ['pointer', 'i32'], result: 'void' },
      glfwGetWindowSize: { parameters: ['pointer', 'buffer', 'buffer'], result: 'void' },
      glfwGetFramebufferSize: { parameters: ['pointer', 'buffer', 'buffer'], result: 'void' },
      glfwSetWindowSize: { parameters: ['pointer', 'i32', 'i32'], result: 'void' },
      glfwGetWindowAttrib: { parameters: ['pointer', 'i32'], result: 'i32' },
      glfwGetWindowPos: { parameters: ['pointer', 'buffer', 'buffer'], result: 'void' },
      glfwGetPrimaryMonitor: { parameters: [], result: 'pointer' },
      glfwGetVideoMode: { parameters: ['pointer'], result: 'pointer' },
      glfwSetWindowMonitor: { parameters: ['pointer', 'pointer', 'i32', 'i32', 'i32', 'i32', 'i32'], result: 'void' },
      glfwIconifyWindow: { parameters: ['pointer'], result: 'void' }, glfwRestoreWindow: { parameters: ['pointer'], result: 'void' },
      glfwGetCursorPos: { parameters: ['pointer', 'buffer', 'buffer'], result: 'void' },
      glfwPollEvents: { parameters: [], result: 'void' },
      glfwGetGamepadState: { parameters: ['i32', 'buffer'], result: 'i32' },
      ...Object.fromEntries(['CursorPos', 'MouseButton', 'Scroll', 'Key', 'Char', 'WindowFocus', 'WindowSize', 'FramebufferSize'].map(name =>
        [`glfwSet${name}Callback`, { parameters: ['pointer', 'function'], result: 'pointer' }])),
      ...(os === 'darwin' ? {
        glfwGetCocoaWindow: { parameters: ['pointer'], result: 'pointer' },
        glfwGetCocoaView: { parameters: ['pointer'], result: 'pointer' },
      } : { glfwGetWin32Window: { parameters: ['pointer'], result: 'pointer' } }),
    } as any) as unknown as GlfwWindow['lib'];
    const f = this.lib.symbols;
    if (!f.glfwInit()) { this.lib.close(); throw new Error('GLFW initialization failed'); }
    f.glfwWindowHint(0x00022001, 0); // NO_API: no OpenGL context is created.
    this.handle = f.glfwCreateWindow(options.width, options.height, new TextEncoder().encode(`${options.title}\0`), null, null);
    if (!this.handle) { f.glfwTerminate(); this.lib.close(); throw new Error('Native window creation failed'); }
    try {
    this.refreshSize();
    let windowHandle: Deno.PointerValue, displayHandle: Deno.PointerValue;
    if (os === 'darwin') {
      windowHandle = f.glfwGetCocoaWindow(this.handle); displayHandle = f.glfwGetCocoaView(this.handle);
    } else {
      windowHandle = f.glfwGetWin32Window(this.handle);
      const kernel = Deno.dlopen('kernel32.dll', { GetModuleHandleW: { parameters: ['pointer'], result: 'pointer' } });
      displayHandle = kernel.symbols.GetModuleHandleW(null); kernel.close();
    }
    this.surface = new Deno.UnsafeWindowSurface({ system: os === 'darwin' ? 'cocoa' : 'win32', windowHandle, displayHandle,
      width: this.pixelWidth, height: this.pixelHeight });
    this.context = this.surface.getContext('webgpu') as GPUCanvasContext;
    if (!this.context) throw new Error('No native GPU canvas context');
    const context = this.context;
    this.lease = new SurfaceLease(context, () => this.surface.present());
    const wrapper = {
      configure: (configuration: GPUCanvasConfiguration) => this.lease.configure(configuration),
      unconfigure: () => this.lease.unconfigure(),
      getCurrentTexture: () => this.lease.current(),
    };
    const self = this;
    this.canvas = {
      get width() { return self.surface.width; }, set width(value: number) { self.surface.width = value; },
      get height() { return self.surface.height; }, set height(value: number) { self.surface.height = value; },
      get clientWidth() { return self.width; }, get clientHeight() { return self.height; },
      getContext: (kind: string) => kind === 'webgpu' ? wrapper : null,
      getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, right: self.width, bottom: self.height, width: self.width, height: self.height }),
      addEventListener: (type: string, listener: (e: any) => void) => self.on(type, listener),
      removeEventListener: (type: string, listener: (e: any) => void) => self.listeners.get(type)?.delete(listener),
      setPointerCapture() {}, releasePointerCapture() {}, focus() {}, style: {},
    };
    this.callback('CursorPos', ['pointer', 'f64', 'f64'], (_w, x, y) => {
      this.position[0] = x; this.position[1] = y; this.pointer('pointermove');
    });
    this.callback('MouseButton', ['pointer', 'i32', 'i32', 'i32'], (_w, button, action) => {
      f.glfwGetCursorPos(this.handle, this.position.subarray(0, 1), this.position.subarray(1, 2));
      const mask = button === 0 ? 1 : button === 1 ? 2 : button === 2 ? 4 : 0;
      this.buttons = action ? this.buttons | mask : this.buttons & ~mask;
      this.pointer(action ? 'pointerdown' : 'pointerup', { button: button === 1 ? 2 : button === 2 ? 1 : button });
    });
    this.callback('Scroll', ['pointer', 'f64', 'f64'], (_w, x, y) => this.pointer('wheel', { deltaX: -x * 40, deltaY: -y * 40, deltaMode: 0 }));
    this.callback('Key', ['pointer', 'i32', 'i32', 'i32', 'i32'], (_w, key, _scan, action, mods) => {
      const mapped = keyName(key); if (!mapped) return;
      if (action === 0) this.keys.delete(mapped); else this.keys.add(mapped);
      this.emit(action === 0 ? 'keyup' : 'keydown', { key: mapped, code: keyCode(mapped), repeat: action === 2,
        shiftKey: !!(mods & 1), ctrlKey: !!(mods & 2), altKey: !!(mods & 4), metaKey: !!(mods & 8) });
    });
    this.callback('Char', ['pointer', 'u32'], (_w, code) => this.emit('textinput', { text: String.fromCodePoint(code) }));
    this.callback('WindowFocus', ['pointer', 'i32'], (_w, value) => {
      this.focused = !!value;
      if (!value) {
        this.buttons = 0; this.pointer('pointercancel');
        for (const key of this.keys) this.emit('keyup', { key, code: keyCode(key) }); this.keys.clear();
      }
      this.emit(value ? 'focus' : 'blur', {});
    });
    for (const name of ['WindowSize', 'FramebufferSize']) this.callback(name, ['pointer', 'i32', 'i32'], () => {
      this.refreshSize(); this.emit('resize', {});
    });
    } catch (error) {
      f.glfwDestroyWindow(this.handle); f.glfwTerminate();
      for (const callback of this.callbacks) callback.close(); this.lib.close(); throw error;
    }
  }
  get scale(): number { return this.width > 0 ? this.pixelWidth / this.width : 1; }
  get closed(): boolean { return this.disposed || !!this.lib.symbols.glfwWindowShouldClose(this.handle); }
  on(type: string, listener: (event: any) => void): () => void {
    let set = this.listeners.get(type); if (!set) this.listeners.set(type, set = new Set()); set.add(listener);
    return () => set!.delete(listener);
  }
  poll(): void {
    this.lib.symbols.glfwPollEvents();
    if (this.callbackError) throw this.callbackError;
    // Standard GLFW gamepad mapping; disconnection emits a neutral state.
    const connected = !!this.lib.symbols.glfwGetGamepadState(0, this.pad);
    if (!connected) this.pad.fill(0);
    const fingerprint = `${connected}:${this.pad.join(',')}`;
    if (fingerprint !== this.lastPad) {
      this.lastPad = fingerprint;
      this.emit('gamepad', { connected, buttons: [...this.pad.subarray(0, 15)], axes: [...new Float32Array(this.pad.buffer, 16, 6)] });
    }
  }
  get minimized() { return !!this.lib.symbols.glfwGetWindowAttrib(this.handle, 0x00020002); }
  get surfaceSkips() { return this.lease.skipped; }
  acquire() { return this.lease.acquire(this.focused); }
  present() { return this.lease.present(); }
  async readFrame(device: GPUDevice): Promise<{ width: number; height: number; rgba: Uint8ClampedArray }> {
    const acquired = this.lease.current();
    const width = this.surface.width, height = this.surface.height, bytesPerRow = Math.ceil(width * 4 / 256) * 256;
    const buffer = device.createBuffer({ size: bytesPerRow * height, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    try {
      const encoder = device.createCommandEncoder();
      encoder.copyTextureToBuffer({ texture: acquired }, { buffer, bytesPerRow }, [width, height]);
      device.queue.submit([encoder.finish()]); await buffer.mapAsync(GPUMapMode.READ);
      const bytes = new Uint8Array(buffer.getMappedRange()), rgba = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y++) rgba.set(bytes.subarray(y * bytesPerRow, y * bytesPerRow + width * 4), y * width * 4);
      if (acquired.format.startsWith('bgra')) for (let i = 0; i < rgba.length; i += 4) [rgba[i], rgba[i + 2]] = [rgba[i + 2], rgba[i]];
      return { width, height, rgba };
    } finally { buffer.unmap(); buffer.destroy(); }
  }
  resize(width: number, height: number) { this.lib.symbols.glfwSetWindowSize(this.handle, width, height); }
  toggleFullscreen() {
    const f = this.lib.symbols;
    if (!this.fullscreen) {
      f.glfwGetWindowPos(this.handle, this.windowed.subarray(0, 1), this.windowed.subarray(1, 2));
      this.windowed[2] = this.width; this.windowed[3] = this.height;
      const monitor = f.glfwGetPrimaryMonitor(), mode = f.glfwGetVideoMode(monitor);
      if (!monitor || !mode) throw new Error('No fullscreen monitor');
      const view = new Deno.UnsafePointerView(mode);
      f.glfwSetWindowMonitor(this.handle, monitor, 0, 0, view.getInt32(0), view.getInt32(4), view.getInt32(20));
    } else f.glfwSetWindowMonitor(this.handle, null, ...this.windowed, 0);
    this.fullscreen = !this.fullscreen;
  }
  minimize() { this.lib.symbols.glfwIconifyWindow(this.handle); }
  restore() { this.lib.symbols.glfwRestoreWindow(this.handle); }
  close() { this.lib.symbols.glfwSetWindowShouldClose(this.handle, 1); }
  dispose(): void {
    if (this.disposed) return; this.disposed = true; this.listeners.clear();
    try { this.lease.unconfigure(); } finally {
    this.lib.symbols.glfwDestroyWindow(this.handle); this.lib.symbols.glfwTerminate();
    for (const callback of this.callbacks) callback.close(); this.lib.close();
    }
  }
  private refreshSize() {
    this.lib.symbols.glfwGetWindowSize(this.handle, this.sizes.subarray(0, 1), this.sizes.subarray(1, 2));
    this.lib.symbols.glfwGetFramebufferSize(this.handle, this.sizes.subarray(2, 3), this.sizes.subarray(3, 4));
    [this.width, this.height, this.pixelWidth, this.pixelHeight] = this.sizes;
  }
  private callback(name: string, parameters: Deno.NativeType[], callback: (...args: any[]) => void) {
    const cb = new Deno.UnsafeCallback({ parameters, result: 'void' }, (...args: any[]) => {
      try { callback(...args); } catch (error) { this.callbackError = error; }
    }); this.callbacks.push(cb);
    this.lib.symbols[`glfwSet${name}Callback`](this.handle, cb.pointer);
  }
  private pointer(type: string, extra = {}) {
    this.emit(type, { pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: this.position[0], clientY: this.position[1],
      offsetX: this.position[0], offsetY: this.position[1], buttons: this.buttons, button: 0, ...extra });
  }
  private emit(type: string, detail: object) {
    const event = { type, target: this.canvas, currentTarget: this.canvas, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...detail };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

function keyName(key: number): string | undefined {
  const special: Record<number, string> = { 300: 'F11', 256: 'Escape', 257: 'Enter', 258: 'Tab', 259: 'Backspace', 261: 'Delete',
    262: 'ArrowRight', 263: 'ArrowLeft', 264: 'ArrowDown', 265: 'ArrowUp', 32: ' ' };
  return special[key] ?? (key >= 32 && key <= 126 ? String.fromCharCode(key).toLowerCase() : undefined);
}

function keyCode(key: string): string {
  if (/^[a-z]$/.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  return key === " " ? "Space" : key;
}
