import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export function syncGameAssets() {
 const result = spawnSync(process.env.PYTHON || 'python3', [fileURLToPath(new URL('prepare-assets.py', import.meta.url))], { stdio: 'inherit' });
 if (result.status !== 0) throw new Error('Asset conversion requires Python with Pillow (set PYTHON).');
}
export function verifyBundledAssets() {
 let count = 0;
 const compare = (relative = '') => {
   const source = new URL(`../src/game-assets/${relative}`, import.meta.url);
   for(const file of readdirSync(source, {withFileTypes:true})) {
     if(file.isDirectory()) { compare(`${relative}${file.name}/`); continue; }
     const bundled = new URL(`../platforms/ios/build/Debug-iphoneos/neoncircuit.app/app/game-assets/${relative}${file.name}`, import.meta.url);
     if(!readFileSync(new URL(file.name,source)).equals(readFileSync(bundled))) throw new Error(`Bundled asset differs: ${relative}${file.name}`);
     count++;
   }
 };
 compare(); console.log(`Verified ${count} bundled resources byte-for-byte.`);
}
