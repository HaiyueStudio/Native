import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
export const runtimeAssets = ['assets/sprites.json', 'assets/sprites.rgba', ...['ui-back','pickup-red','pickup-blue','pickup-purple','pickup-bomb','ui-click','shot-basic','shot-red','shot-blue','shot-enemy','explosion-small','explosion-large','explosion-boss','bomb','hit','laser-start','laser-loop','laser-end','laser-enemy'].map(id=>`assets/audio/${id}.wav`), ...Array.from({length:10},(_,i)=>`levels/level-${String(i+1).padStart(2,'0')}.json`), 'levels/level-12.json'];
/** This directory is generated: original art stays in Games, never in the app bundle. */
export function syncGameAssets({
  source = new URL('../../../../Games/games/sky-strike/', import.meta.url),
  target = new URL('../src/game-assets/', import.meta.url),
  staleTargets = [new URL('../platforms/ios/skystrike/app/game-assets/', import.meta.url), new URL('../platforms/ios/build/Debug-iphoneos/skystrike.app/app/game-assets/', import.meta.url)],
} = {}) {
  // Validate everything before replacing previously staged generated resources.
  for (const relative of runtimeAssets) if (!existsSync(new URL(relative, source))) throw new Error(`Missing Sky Strike runtime resource: ${relative}`);
  for (const directory of [target, ...staleTargets]) rmSync(directory, { recursive: true, force: true });
  for (const relative of runtimeAssets) {
    mkdirSync(dirname(fileURLToPath(new URL(relative, target))), { recursive: true });
    copyFileSync(new URL(relative, source), new URL(relative, target));
  }
}
