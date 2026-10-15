import { validateCatalog } from '../core/catalog';
import { AchievementError } from '../core/types';
import type { AchievementCatalog, AchievementProvider, ProviderContext, ProviderProgress, ProviderSession } from '../core/types';

/** One owner per Steam process. The host pumps callbacks and owns SDK shutdown. */
export interface SteamAchievementClient {
  initialize(appId: string): Promise<void>;
  getSession(): ProviderSession;
  subscribe(listener: () => void): () => void;
  read(playerId: string, achievementId: string, stat: string | undefined, signal: AbortSignal): Promise<{ unlocked: boolean; value: number }>;
  /** One StoreStats call for a batch, resolving only on UserStatsStored_t success. */
  store(playerId: string, changes: readonly { achievementId: string; stat?: string; value: number; unlock: boolean }[], signal: AbortSignal): Promise<void>;
  dispose(): void;
}

export function createSteamAchievementProvider(options: {
  appId: string; catalog: AchievementCatalog; client: SteamAchievementClient;
}): AchievementProvider {
  if (!/^[1-9][0-9]*$/.test(options.appId) || BigInt(options.appId) > 0xffffffffn) throw new AchievementError('invalid-app-id', 'Steam App ID must be uint32');
  const catalog = validateCatalog(options.catalog), client = options.client;
  const ids = new Set<string>(), stats = new Set<string>();
  for (const d of catalog.definitions) {
    const map = d.platform?.steam;
    if (!map || !/^[\w.-]{1,128}$/.test(map.achievementId) || ids.has(map.achievementId) || d.target > 0x7fffffff ||
      (d.target > 1 && !map.progressStat) || (map.progressStat !== undefined && (!/^[\w.-]{1,128}$/.test(map.progressStat) || stats.has(map.progressStat)))) {
      throw new AchievementError('invalid-steam-catalog', 'Unique achievement IDs/int32 stats required; multi-step progress needs a stat');
    }
    ids.add(map.achievementId); if (map.progressStat) stats.add(map.progressStat);
  }
  let disposed = false;
  const guard = (context: ProviderContext) => {
    if (disposed || context.signal.aborted) throw new AchievementError('session-changed', 'Steam operation cancelled');
    const session = client.getSession();
    if (session.state !== 'ready' || session.playerId !== context.session.playerId || !session.playerId) throw new AchievementError('session-changed', 'Steam player changed');
    return session.playerId;
  };
  const read = async (context: ProviderContext, forReport = false): Promise<ProviderProgress[]> => {
    const result: ProviderProgress[] = [];
    for (const d of catalog.definitions) {
      const m = d.platform!.steam!;
      const state = await client.read(guard(context), m.achievementId, m.progressStat, context.signal); guard(context);
      if (!Number.isSafeInteger(state.value) || state.value < 0 || state.value > 0x7fffffff) throw new AchievementError('invalid-provider-data', 'Invalid Steam stat');
      // A full stat is not proof that SetAchievement/StoreStats completed. Keep
      // the facade intent pending until GetAchievement itself reads unlocked.
      result.push({ id: d.id, value: state.unlocked ? d.target : Math.min(forReport ? d.target : d.target - 1, state.value) });
    }
    return result;
  };
  return {
    kind: 'steam', applicationId: options.appId,
    // A wgpu overlay is not assumed to work. Use the Engine GUI until separately verified.
    capabilities: Object.freeze({ authentication: false, query: true, persistentProgress: true, nativeUI: false, remoteSync: true }),
    initialize: () => client.initialize(options.appId), getSession: () => client.getSession(), subscribe: fn => client.subscribe(fn), load: read,
    async report(progress, context) {
      const remote = await read(context, true), seen = new Set<string>();
      const changes = progress.map(p => {
        const d = catalog.definitions.find(d => d.id === p.id);
        if (!d || seen.has(p.id) || !Number.isSafeInteger(p.value) || p.value < 0 || p.value > d.target) throw new AchievementError('invalid-progress', 'Invalid Steam progress');
        seen.add(p.id); const m = d.platform!.steam!;
        const value = Math.max(p.value, remote.find(r => r.id === p.id)!.value);
        return { achievementId: m.achievementId, stat: m.progressStat, value, unlock: value === d.target, hidden: !!d.hidden };
      }).filter(p => !p.hidden || p.unlock);
      if (changes.length) { await client.store(guard(context), changes, context.signal); guard(context); }
    },
    dispose() { if (!disposed) { disposed = true; client.dispose(); } },
  };
}
