import { File, knownFolders, path } from '@nativescript/core';
import type { Canvas } from '@nativescript/canvas';
import type { HaiyueEngine } from '@haiyue/engine';
import type { SkyStrikeBattleLayer } from '../../../games/sky-strike/battleLayer';
import type { SkyStrikeGame } from '../../../games/sky-strike/SkyStrikeGame';
import { captureSurfaceFrame } from '../../../bridge/render/frame-capture.ios';

/** Launch-only regression using MemorySaveBackend; no player progress is changed. */
export function previewProbe(engine: HaiyueEngine, battle: SkyStrikeBattleLayer, game: SkyStrikeGame, canvas: Canvas): () => void {
  const diagnostic = game as any;
  const rows: unknown[] = [];
  const output = File.fromPath(path.join(knownFolders.documents().path, 'sky-preview-probe.json'));
  const compose = battle.guiComposition.bind(battle);
  let step = 0, frames = 0, done = false;
  // Exercise both cached portraits and new GPU compositions after gameplay.
  battle.guiComposition = (key, draw) => compose(step >= diagnostic.levels.length * 2 ? `${key}:probe-fresh` : key, draw);
  const write = (extra: object) => output.writeTextSync(JSON.stringify({ rows, memorySave: true, ...extra }));
  const afterFrame = () => {
    if (done) return;
    try {
      const level = step % diagnostic.levels.length;
      if (frames === 0) {
        diagnostic.selectedLevelIndex = level;
        diagnostic.startSortie();
      }
      if (frames === 15) diagnostic.finishSortie();
      if (++frames < 45) return;
      const capture = captureSurfaceFrame(canvas, `sky-preview-${String(step).padStart(2, '0')}.png`);
      rows.push({ step, round: Math.floor(step / diagnostic.levels.length), level: level + 1, ...capture, rendering: battle.stats() });
      step++; frames = 0;
      done = step >= diagnostic.levels.length * 3;
      write({ complete: done });
      if (done) {
        battle.guiComposition = compose;
        diagnostic.levelCarousel.show(4, true);
      }
    } catch (error) {
      done = true; battle.guiComposition = compose;
      write({ complete: false, error: String(error) });
    }
  };
  // Registered before the host presents/releases the acquired drawable.
  engine.on('after-update', afterFrame);
  write({ complete: false });
  return () => { done = true; engine.off('after-update', afterFrame); battle.guiComposition = compose; };
}
