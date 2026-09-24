import { readNativeBytes } from '../../../bridge/files/read-bytes';
import { File, knownFolders, path } from '@nativescript/core';
import { NativeCanvasTextures } from '../../../bridge/render/canvas-textures';
import type { NeonRaster } from '../../../../Games/games/neon-circuit/NeonRaster';
import type { Canvas } from '@nativescript/canvas';

/** Predecoded, straight-alpha RGBA is bundled with the app and uploaded directly to Metal. */
export class NativeNeonRaster implements NeonRaster {
  private readonly transient = new Set<Canvas>();
  private readonly fontSurfaces = new Set<Canvas>();
  readonly canvas: NeonRaster['canvas'];
  readonly pixels: NeonRaster['pixels'];
  readonly font: { canvasFactory: NativeCanvasTextures['createCanvas2D']; readAtlasPixels: NativeCanvasTextures['readAtlasPixels'] };
  private readonly directory = path.join(knownFolders.currentApp().path, 'game-assets');
  private readonly entries: Record<string, { width: number; height: number; file: string }>;
  constructor(device: GPUDevice) {
    const canvas = new NativeCanvasTextures(device);
    this.canvas = (width,height) => {
      const surface=canvas.createCanvas2D(width,height);
      this.transient.add(surface as unknown as Canvas);return surface;
    };
    this.pixels = source => canvas.readAtlasPixels(source as HTMLCanvasElement);
    this.font = { canvasFactory: (width,height) => {
      const surface=canvas.createCanvas2D(width,height);
      this.fontSurfaces.add(surface as unknown as Canvas);return surface;
    }, readAtlasPixels: canvas.readAtlasPixels };
    this.entries = JSON.parse(File.fromPath(path.join(this.directory, 'textures.json')).readTextSync());
  }
  /** Raster uploads copy pixels immediately. After the frame, only the GPU copies are needed. */
  flushTransient(): number { return this.release(this.transient); }
  releaseScene(): void { this.release(this.transient);this.release(this.fontSurfaces); }
  private release(surfaces:Set<Canvas>):number {
    const count=surfaces.size;
    for(const surface of surfaces) {
      // Resize first to release Skia's backing store even before the JS wrapper is collected.
      surface.width=1;surface.height=1;surface.disposeNativeView();
    }
    surfaces.clear();return count;
  }
  get surfaceCount():number {return this.transient.size+this.fontSurfaces.size;}
  async loadTexture(device: GPUDevice, name: string): Promise<GPUTexture> {
    const entry = this.entries[name];
    if (!entry) throw new Error(`Missing native texture ${name}`);
    const rgba = new Uint8Array(readNativeBytes(path.join(this.directory, entry.file)));
    if (rgba.byteLength !== entry.width * entry.height * 4) throw new Error(`Invalid RGBA length: ${name}`);
    const texture = device.createTexture({ label: name, size: [entry.width, entry.height], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    try { device.queue.writeTexture({ texture }, rgba, { bytesPerRow: entry.width * 4 }, [entry.width, entry.height]); return texture; }
    catch (error) { texture.destroy(); throw error; }
  }
}
