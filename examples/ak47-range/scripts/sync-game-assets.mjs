import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
export function syncGameAssets() {
  for (const name of ['ren42', 'qiang_ak47']) {
    const source = new URL(`../../../../Games/games/ak47-range/assets/${name}/`, import.meta.url);
    if (!existsSync(new URL('model.gltf', source))) throw new Error(`Prepare Games AK47 assets first: ${name}`);
    const target = new URL(`../src/game-assets/${name}/`, import.meta.url); mkdirSync(target, { recursive: true });
    cpSync(source, target, { recursive: true, filter: path => !/\.(jpg|png)$/.test(path) });
  }
}
export function verifyBundledAssets() {
  let count = 0;
  for (const name of ['ren42', 'qiang_ak47']) {
    const source = new URL(`../src/game-assets/${name}/`, import.meta.url);
    const bundled = new URL(`../platforms/ios/build/Debug-iphoneos/ak47range.app/app/game-assets/${name}/`, import.meta.url);
    for (const file of readdirSync(source)) {
      if (!readFileSync(new URL(file, source)).equals(readFileSync(new URL(file, bundled)))) throw new Error(`Bundled asset differs: ${name}/${file}`);
      count++;
    }
  }
  console.log(`Verified ${count} bundled model/texture files byte-for-byte.`);
}
