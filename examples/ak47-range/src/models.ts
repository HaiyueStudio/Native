import { File, knownFolders, path } from '@nativescript/core';
import { AssetManager, type AssetHandle, type TextureAssetOptions } from '@haiyue/engine/assets';
import { loadGltfModel, type GltfAssetWorker, type LoadedGltfModel } from '@haiyue/extensions/gltf';
interface TextureEntry { image: string; rgba: string; width: number; height: number }
function bytes(file: string): ArrayBuffer {
  const data = NSData.dataWithContentsOfFile(file);
  if (!data) throw new Error(`Missing bundled model resource: ${file}`);
  return interop.bufferFromData(data).slice(0);
}
/** The public loader/handle contract uploads bundled RGBA; no browser image APIs or network. */
class BundledTextures extends AssetManager {
  constructor(private readonly gpu: GPUDevice, private readonly directory: string, private readonly entries: TextureEntry[]) { super(gpu); }
  override loadTexture(source: Parameters<AssetManager['loadTexture']>[0], options: TextureAssetOptions = {}): Promise<AssetHandle<GPUTexture>> {
    if (typeof source !== 'string') return Promise.reject(new Error('Expected bundled image URL'));
    const entry = this.entries.find(e => source.endsWith('/' + e.image));
    if (!entry) return Promise.reject(new Error(`Unmapped model texture: ${source}`));
    const format = options.format ?? 'rgba8unorm-srgb';
    return this.load(`bundled:${source}:${format}`, async () => {
      const data = new Uint8Array(bytes(path.join(this.directory, entry.rgba)));
      if (data.byteLength !== entry.width * entry.height * 4) throw new Error('Bundled texture length mismatch');
      const texture = this.gpu.createTexture({ label: entry.image, size: [entry.width, entry.height], format,
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
      try { this.gpu.queue.writeTexture({ texture }, data, { bytesPerRow: entry.width * 4 }, [entry.width, entry.height]); }
      catch (error) { texture.destroy(); throw error; }
      return texture;
    }, texture => texture.destroy(), { signal: options.signal });
  }
}
export class NativeModels {
  private managers: AssetManager[] = [];
  constructor(private readonly gpu: GPUDevice) {}
  readonly load = async (name: 'ren42' | 'qiang_ak47'): Promise<LoadedGltfModel> => {
    const directory = path.join(knownFolders.currentApp().path, 'game-assets', name);
    const gltf = JSON.parse(File.fromPath(path.join(directory, 'model.gltf')).readTextSync());
    const binary = bytes(path.join(directory, 'model.bin'));
    const entries: TextureEntry[] = JSON.parse(File.fromPath(path.join(directory, 'textures.json')).readTextSync());
    const manager = new BundledTextures(this.gpu, directory, entries); this.managers.push(manager);
    const assetWorker: GltfAssetWorker = { async loadParsedAsset() {
      return { gltf, binaryChunk: binary, buffers: [binary], baseUrl: `https://bundled.haiyue.invalid/${name}/` };
    } };
    return loadGltfModel(`https://bundled.haiyue.invalid/${name}/model.gltf`, { assetWorker, assetManager: manager });
  };
  dispose(): void { for (const manager of this.managers) manager.dispose(); this.managers = []; }
}
