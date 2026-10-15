import { AchievementError } from '../../../bridge/achievements/core/types';
import type { ProviderSession } from '../../../bridge/achievements/core/types';
import type { SteamAchievementClient } from '../../../bridge/achievements/steam/index';

const cstring = (s: string) => { if (s.includes('\0')) throw new Error('Invalid C string'); return new TextEncoder().encode(s + '\0'); };
let activeOwner = false;
/** Construct only for a Steam distribution. No DLL loads on importing core/local mode. */
export function createDesktopSteamClient(path: string): SteamAchievementClient {
  if (activeOwner) throw new Error('A desktop Steam client already owns this process');
  const lib = Deno.dlopen(path, {
    hy_steam_abi: { parameters: [], result: 'i32' }, hy_steam_init: { parameters: ['u32'], result: 'i32' },
    hy_steam_pump: { parameters: [], result: 'void' }, hy_steam_player: { parameters: [], result: 'u64' },
    hy_steam_online: { parameters: [], result: 'i32' },
    hy_steam_achievement: { parameters: ['u64', 'buffer'], result: 'i32' },
    hy_steam_stat: { parameters: ['u64', 'buffer', 'buffer'], result: 'i32' },
    hy_steam_set: { parameters: ['u64', 'buffer', 'buffer', 'i32', 'i32'], result: 'i32' },
    hy_steam_store: { parameters: ['u64'], result: 'i32' }, hy_steam_completion: { parameters: [], result: 'i32' },
    hy_steam_shutdown: { parameters: [], result: 'void' },
  });
  const s = lib.symbols;
  if (s.hy_steam_abi() !== 1) { lib.close(); throw new Error('Unsupported Steam ABI'); }
  activeOwner = true;
  let alive = true, initialized = false, timer: ReturnType<typeof setInterval> | undefined;
  let session: ProviderSession = { state: 'unavailable' };
  const listeners = new Set<() => void>();
  let pending: { finish: (error?: Error) => void } | undefined;
  const refresh = () => {
    if (!alive || !initialized) return;
    const id = s.hy_steam_player(), next: ProviderSession = id ? { state: s.hy_steam_online() ? 'ready' : 'offline', playerId: String(id) } : { state: 'unavailable' };
    if (JSON.stringify(session) !== JSON.stringify(next)) { session = next; for (const fn of [...listeners]) { try { fn(); } catch { /* Listener isolation. */ } } }
  };
  const guard = (id: string, signal: AbortSignal) => {
    refresh();
    if (!alive || signal.aborted || session.state !== 'ready' || session.playerId !== id) throw new AchievementError('session-changed', 'Steam session changed');
    return BigInt(id);
  };
  const check = (n: number) => {
    if (n < 0) throw new AchievementError(n === -2 ? 'session-changed' : n === -3 ? 'busy' : 'steam-stats-not-ready', `Steam API result ${n}`, n !== -2);
  };
  return {
    async initialize(appId) {
      if (!alive) throw new Error('Steam client disposed');
      if (initialized) return;
      const result = s.hy_steam_init(Number(appId));
      if (result === 0) return; // Missing Steam client: local gameplay remains available.
      if (result !== 1) throw new AchievementError('steam-init', `Steam initialization failed: ${result}`);
      initialized = true; refresh();
      timer = setInterval(() => {
        s.hy_steam_pump(); refresh(); const result = s.hy_steam_completion();
        if (result !== 0 && result !== 1) pending?.finish(result === 2 ? undefined : new AchievementError('steam-store', `UserStatsStored result ${result}`, result !== -8 && result !== -10001));
      }, 50);
    },
    getSession() { refresh(); return { ...session }; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async read(id, achievement, stat, signal) {
      const player = guard(id, signal), unlocked = s.hy_steam_achievement(player, cstring(achievement)); check(unlocked);
      const value = new Int32Array(1);
      if (stat) { const code = s.hy_steam_stat(player, cstring(stat), value); if (code === -1) throw new AchievementError('invalid-steam-stat', `Missing/non-int32 Steam stat: ${stat}`); check(code); }
      return { unlocked: unlocked === 1, value: value[0] };
    },
    async store(id, changes, signal) {
      const player = guard(id, signal);
      if (pending) throw new AchievementError('busy', 'StoreStats is still pending', true);
      for (const c of changes) check(s.hy_steam_set(player, cstring(c.achievementId), cstring(c.stat ?? ''), c.value, Number(c.unlock)));
      check(s.hy_steam_store(player));
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error) => { if (settled) return; settled = true; signal.removeEventListener('abort', abort); clearTimeout(timeout); pending = undefined; error ? reject(error) : resolve(); };
        // Native retains its pending slot after abort/timeout, so a late callback cannot settle a later write.
        const abort = () => finish(new AchievementError('session-changed', 'Steam store cancelled'));
        const timeout = setTimeout(() => finish(new AchievementError('timeout', 'Steam StoreStats callback timed out', true)), 15000);
        pending = { finish }; signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
      });
    },
    dispose() { if (!alive) return; alive = false; if (timer) clearInterval(timer); pending?.finish(new AchievementError('disposed', 'Steam disposed')); listeners.clear(); if (initialized) s.hy_steam_shutdown(); lib.close(); activeOwner = false; },
  };
}
