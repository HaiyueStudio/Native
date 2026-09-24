import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
export const runtimeAssets = ['assets/sprites.json', 'assets/sprites.rgba', ...['boss-warning','orbital-drift','ui-back','pickup-red','pickup-blue','pickup-purple','pickup-bomb','ui-click','shot-basic','shot-red','shot-blue','shot-enemy','explosion-small','explosion-large','explosion-boss','bomb','hit','laser-start','laser-loop','laser-end','laser-enemy'].map(id=>`assets/audio/${id}.wav`), ...Array.from({length:12},(_,i)=>`levels/level-${String(i+1).padStart(2,'0')}.json`)];
/** Original art lives in Native/games; only the generated pack goes into the app. */
export function syncGameAssets({
  source = new URL('../../../games/sky-strike/', import.meta.url),
  target = new URL('../src/game-assets/', import.meta.url),
  packSprites = (source, target) => execFileSync(process.env.PYTHON || 'python3', [fileURLToPath(new URL('../../../scripts/assets/pack-sky-sprites.py', import.meta.url)),
    '--source', fileURLToPath(new URL('assets/', source)), '--output', fileURLToPath(new URL('assets/', target))], { stdio: 'inherit' }),
  staleTargets = [new URL('../platforms/ios/skystrike/app/game-assets/', import.meta.url), new URL('../platforms/ios/build/Debug-iphoneos/skystrike.app/app/game-assets/', import.meta.url)],
} = {}) {
  // Validate everything before replacing previously staged generated resources.
  const copiedAssets = runtimeAssets.filter(file => !file.startsWith('assets/sprites.'));
  for (const relative of copiedAssets) if (!existsSync(new URL(relative, source))) throw new Error(`Missing Sky Strike runtime resource: ${relative}`);
  for (const directory of [target, ...staleTargets]) rmSync(directory, { recursive: true, force: true });
  packSprites(source, target);
  for (const relative of copiedAssets) {
    mkdirSync(dirname(fileURLToPath(new URL(relative, target))), { recursive: true });
    copyFileSync(new URL(relative, source), new URL(relative, target));
  }
}
