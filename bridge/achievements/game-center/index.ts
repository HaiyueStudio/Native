import { validateCatalog } from '../core/catalog';
import { AchievementError } from '../core/types';
import type { AchievementCatalog, AchievementProvider, ProviderContext, ProviderProgress, ProviderSession } from '../core/types';

/** GameKit operations must recheck the expected gamePlayerID on the UI thread. */
export interface GameCenterAchievementClient {
  readonly nativeUI: boolean;
  initialize(bundleId: string): Promise<void>;
  getSession(): ProviderSession;
  subscribe(listener: () => void): () => void;
  load(playerId: string, signal: AbortSignal): Promise<readonly { achievementId: string; percent: number }[]>;
  report(playerId: string, progress: readonly { achievementId: string; percent: number }[], signal: AbortSignal): Promise<void>;
  showUI?(playerId: string, signal: AbortSignal): Promise<void>;
  dispose(): void;
}

export function createGameCenterAchievementProvider(options: {
  bundleId: string; catalog: AchievementCatalog; client: GameCenterAchievementClient;
}): AchievementProvider {
  if (!/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(options.bundleId)) throw new AchievementError('invalid-app-id', 'Game Center requires a Bundle ID');
  const catalog = validateCatalog(options.catalog), client = options.client, ids = new Set<string>();
  for (const d of catalog.definitions) {
    const m = d.platform?.gameCenter;
    if (!m || !/^[\w.-]{1,100}$/.test(m.achievementId) || ids.has(m.achievementId)) throw new AchievementError('invalid-game-center-catalog', 'Unique Game Center achievement IDs required');
    ids.add(m.achievementId);
  }
  let disposed = false;
  const guard = (context: ProviderContext) => {
    const s = client.getSession();
    if (disposed || context.signal.aborted || s.state !== 'ready' || !s.playerId || s.playerId !== context.session.playerId) throw new AchievementError('session-changed', 'Game Center player changed');
    return s.playerId;
  };
  const loadPercent = async (context: ProviderContext) => {
    const data = await client.load(guard(context), context.signal); guard(context);
    const map = new Map<string, number>();
    for (const p of data) {
      if (!Number.isFinite(p.percent) || p.percent < 0 || p.percent > 100 || map.has(p.achievementId)) throw new AchievementError('invalid-provider-data', 'Invalid Game Center progress');
      map.set(p.achievementId, p.percent);
    }
    return map;
  };
  const read = async (context: ProviderContext): Promise<ProviderProgress[]> => {
    const map = await loadPercent(context);
    return catalog.definitions.map(d => {
      const p = map.get(d.platform!.gameCenter!.achievementId) ?? 0;
      // Never round 99.999% to an unlock. The epsilon only repairs sub-integer float drift.
      return { id: d.id, value: p === 100 ? d.target : Math.min(d.target - 1, Math.floor(p / 100 * d.target + 1e-9)) };
    });
  };
  return {
    kind: 'game-center', applicationId: options.bundleId,
    capabilities: Object.freeze({ authentication: true, query: true, persistentProgress: true, nativeUI: client.nativeUI, remoteSync: true }),
    initialize: () => client.initialize(options.bundleId), getSession: () => client.getSession(), subscribe: fn => client.subscribe(fn), load: read,
    async report(progress, context) {
      const remote = await loadPercent(context), seen = new Set<string>();
      const changes = progress.map(p => {
        const d = catalog.definitions.find(d => d.id === p.id);
        if (!d || seen.has(p.id) || !Number.isSafeInteger(p.value) || p.value < 0 || p.value > d.target) throw new AchievementError('invalid-progress', 'Invalid Game Center progress');
        seen.add(p.id); const achievementId = d.platform!.gameCenter!.achievementId;
        const percent = p.value === d.target ? 100 : Math.min(100 - Number.EPSILON * 100, p.value / d.target * 100);
        return { achievementId, percent: Math.max(percent, remote.get(achievementId) ?? 0), hidden: !!d.hidden, complete: p.value === d.target };
      }).filter(p => !p.hidden || p.complete);
      if (changes.length) { await client.report(guard(context), changes, context.signal); guard(context); }
    },
    async showUI(context) {
      if (!client.nativeUI || !client.showUI) throw new AchievementError('unsupported', 'Game Center UI unavailable');
      await client.showUI(guard(context), context.signal); guard(context);
    },
    dispose() { if (!disposed) { disposed = true; client.dispose(); } },
  };
}
