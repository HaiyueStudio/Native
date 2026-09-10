import { copyFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
export const runtimeAssets = ['assets/sprites.json', 'assets/sprites.rgba', ...Array.from({length:7},(_,i)=>`levels/level-0${i+1}.json`)];
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
    mkdirSync(new URL(relative.startsWith('assets/') ? 'assets/' : 'levels/', target), { recursive: true });
    copyFileSync(new URL(relative, source), new URL(relative, target));
  }
}
