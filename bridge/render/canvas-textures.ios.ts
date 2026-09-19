import { Canvas } from '@nativescript/canvas';
/** Canvas 2D rasterization with explicit RGBA upload; game rendering remains WebGPU. */
export class NativeCanvasTextures {
  private readonly textures = new Map<string, { texture: GPUTexture; width: number; height: number }>();
  constructor(private readonly device: GPUDevice, private readonly format: 'rgba8unorm' | 'rgba8unorm-srgb' = 'rgba8unorm') {}
  readonly createCanvas2D = (width: number, height: number): HTMLCanvasElement => {
    const canvas = new Canvas();
    canvas.width = width;
    canvas.height = height;
    return canvas as unknown as HTMLCanvasElement;
  };
  readonly readAtlasPixels = (canvas: HTMLCanvasElement): Uint8Array => {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Native Canvas 2D context is unavailable.');
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  };
  readonly textureFromCanvas = (canvas: HTMLCanvasElement, key: string): GPUTexture => {
    const { width, height } = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Native Canvas 2D context is unavailable.');
    const pixels = context.getImageData(0, 0, width, height).data;
    let entry = this.textures.get(key);
    if (!entry || entry.width !== width || entry.height !== height) {
      if (entry) {
        const old = entry.texture;
        void this.device.queue.onSubmittedWorkDone().then(() => old.destroy());
      }
      entry = { width, height, texture: this.device.createTexture({ label: `native-game:${key}`, size: [width, height], format: this.format, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST }) };
      this.textures.set(key, entry);
    }
    this.device.queue.writeTexture({ texture: entry.texture }, new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength), { bytesPerRow: width * 4 }, [width, height]);
    return entry.texture;
  };
  snapshot() { return { textures: this.textures.size, bytes: [...this.textures.values()].reduce((sum, item) => sum + item.width * item.height * 4, 0) }; }
  dispose(): void { for (const item of this.textures.values()) item.texture.destroy(); this.textures.clear(); }
}
