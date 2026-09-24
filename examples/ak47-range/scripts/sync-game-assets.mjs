import { readdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export function syncGameAssets() {
  const source = path.join(process.env.HAIYUE_MODEL_ASSETS || fileURLToPath(new URL('../../../local-assets/', import.meta.url)), 'ak47-range');
  for (const name of ['ren42', 'qiang_ak47']) if (!existsSync(path.join(source, `${name}.glb`)))
    throw new Error(`Missing user-provided model: ${path.join(source, `${name}.glb`)}. See games/ASSETS.md.`);
  const target = new URL('../src/game-assets/', import.meta.url);
  rmSync(target, { recursive: true, force: true });
  execFileSync(process.env.PYTHON || 'python3', [fileURLToPath(new URL('../../../scripts/assets/prepare-ak47-assets.py', import.meta.url)),
    '--source', source, '--output', fileURLToPath(target)], { stdio: 'inherit' });
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
