import { File, knownFolders, path } from '@nativescript/core';
import { NativeCanvasTextures } from '../../../bridge/render/canvas-textures.ios';
import type { NeonRaster } from '../../../../Games/games/neon-circuit/NeonRaster';

/** Predecoded, straight-alpha RGBA is bundled with the app and uploaded directly to Metal. */
export class NativeNeonRaster implements NeonRaster {
  readonly canvas: NeonRaster['canvas'];
  readonly pixels: NeonRaster['pixels'];
  readonly font: { canvasFactory: NativeCanvasTextures['createCanvas2D']; readAtlasPixels: NativeCanvasTextures['readAtlasPixels'] };
  private readonly directory = path.join(knownFolders.currentApp().path, 'game-assets');
  private readonly entries: Record<string, { width: number; height: number; file: string }>;
  constructor(device: GPUDevice) {
    const canvas = new NativeCanvasTextures(device);
    this.canvas = canvas.createCanvas2D;
    this.pixels = source => canvas.readAtlasPixels(source as HTMLCanvasElement);
    this.font = { canvasFactory: canvas.createCanvas2D, readAtlasPixels: canvas.readAtlasPixels };
    this.entries = JSON.parse(File.fromPath(path.join(this.directory, 'textures.json')).readTextSync());
  }
  async loadTexture(device: GPUDevice, name: string): Promise<GPUTexture> {
    const entry = this.entries[name];
    if (!entry) throw new Error(`Missing native texture ${name}`);
    const data = NSData.dataWithContentsOfFile(path.join(this.directory, entry.file));
    if (!data) throw new Error(`Cannot read native texture ${name}`);
    const rgba = new Uint8Array(interop.bufferFromData(data));
    if (rgba.byteLength !== entry.width * entry.height * 4) throw new Error(`Invalid RGBA length: ${name}`);
    const texture = device.createTexture({ label: name, size: [entry.width, entry.height], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    try { device.queue.writeTexture({ texture }, rgba, { bytesPerRow: entry.width * 4 }, [entry.width, entry.height]); return texture; }
    catch (error) { texture.destroy(); throw error; }
  }
}
