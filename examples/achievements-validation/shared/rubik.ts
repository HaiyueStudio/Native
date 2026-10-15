import { createAchievements, createAchievementStorage, type AchievementCatalog, type AchievementProvider } from '../../../bridge/achievements/index';
import { createLocalAchievementProvider } from '../../../bridge/achievements/local/index';
import { CubeAchievements, cubeAchievementDefinitions } from '../../../games/rubiks-cube/achievements';

/** These are backend configuration names, not claims that platform entries already exist. */
export const rubikAchievementCatalog: AchievementCatalog = {
  schemaVersion: 1, gameId: 'rubiks-cube', environment: 'development', version: '1',
  definitions: cubeAchievementDefinitions.map(d => ({ ...d, platform: {
    steam: { achievementId: d.id.replace(/\./g, '_').toUpperCase(), ...(d.target > 1 ? { progressStat: 'RUBIK_SOLVES' } : {}) },
    gameCenter: { achievementId: d.id },
  } })),
};
export async function createRubikAchievements(storage: { getItem(key: string): string | null; setItem(key: string, value: string): void },
  provider: AchievementProvider = createLocalAchievementProvider('org.haiyue.rubik')) {
  const facade = createAchievements({ catalog: rubikAchievementCatalog, provider, guestProfile: 'device-guest', storage: createAchievementStorage(storage) });
  try { await facade.initialize(); } catch (error) { facade.dispose(); throw error; }
  const session = facade.getSession();
  // Pin this gameplay runtime to its starting identity. Recreate it explicitly after signing in/out.
  const guard = () => { if (facade.getSession().playerId !== session.playerId) throw new Error('Achievement account changed; reopen the game to use the new profile'); };
  const achievements = new CubeAchievements({
    profile: JSON.stringify(['rubik', 'development', provider.kind, provider.applicationId, session.playerId ?? 'device-guest']),
    port: { contractVersion: 1, reportProgress(id, value) { guard(); return facade.reportProgress(id, value); }, unlock(id) { guard(); return facade.unlock(id); } },
    storage: { async read(key) { const saved = storage.getItem(key); return saved === null ? null : JSON.parse(saved); }, async write(key, data) { storage.setItem(key, JSON.stringify(data)); } },
    flush: () => { guard(); return facade.flush(); },
  });
  const dispose = achievements.dispose.bind(achievements);
  achievements.dispose = () => { dispose(); facade.dispose(); };
  return achievements;
}
