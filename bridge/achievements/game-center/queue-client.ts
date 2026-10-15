import { AchievementError } from '../core/types';
import type { ProviderSession } from '../core/types';
import type { GameCenterAchievementClient } from './index';

/** ABI v1 plain JSON event queue, shared by NativeScript and desktop FFI. */
export interface GameCenterQueueBridge {
  start(bundleId: string): void;
  session(): string;
  request(json: string): boolean;
  poll(): string;
  stop(): void;
}
export function createGameCenterQueueClient(bridge: GameCenterQueueBridge): GameCenterAchievementClient {
  const listeners = new Set<() => void>();
  const jobs = new Map<number, { finish(error: Error | undefined, value?: unknown): void }>();
  let nextId = 0, dead = false, started = false, timer: ReturnType<typeof setInterval> | undefined;
  let session: ProviderSession = { state: 'unavailable' };
  const refresh = () => {
    if (dead || !started) return;
    const value = JSON.parse(bridge.session()) as ProviderSession;
    if (!['unavailable', 'authenticating', 'guest', 'ready'].includes(value.state) || (value.state === 'ready' && !value.playerId)) throw new AchievementError('invalid-provider-data', 'Invalid Game Center session');
    if (value.state !== session.state || value.playerId !== session.playerId) {
      session = value; for (const listener of [...listeners]) { try { listener(); } catch { /* Listener isolation. */ } }
    }
  };
  const request = <T>(operation: string, playerId: string, signal: AbortSignal, progress?: unknown): Promise<T> => new Promise((resolve, reject) => {
    refresh();
    if (dead || signal.aborted || session.state !== 'ready' || playerId !== session.playerId) { reject(new AchievementError('session-changed', 'Game Center session changed')); return; }
    if (jobs.size >= 32) { reject(new AchievementError('busy', 'Too many Game Center requests', true)); return; }
    const id = ++nextId;
    const finish = (error: Error | undefined, value?: unknown) => {
      if (!jobs.delete(id)) return;
      signal.removeEventListener('abort', abort); clearTimeout(timeout); error ? reject(error) : resolve(value as T);
    };
    const abort = () => finish(new AchievementError('session-changed', 'Game Center request cancelled'));
    const timeout = setTimeout(() => finish(new AchievementError('timeout', 'GameKit callback timed out', true)), 15000);
    jobs.set(id, { finish }); signal.addEventListener('abort', abort, { once: true });
    try { if (!bridge.request(JSON.stringify({ id, operation, playerId, progress }))) finish(new AchievementError('busy', 'GameKit queue unavailable', true)); }
    catch (e) { finish(e instanceof Error ? e : new Error(String(e))); }
  });
  return {
    nativeUI: true,
    async initialize(bundleId) {
      if (dead) throw new Error('Game Center disposed'); if (started) return;
      bridge.start(bundleId); started = true; refresh();
      if (session.state === 'unavailable') { bridge.stop(); started = false; throw new AchievementError('game-center-init', 'Bundle identity mismatch or another GameKit owner is active'); }
      timer = setInterval(() => {
        try {
          refresh();
          const events = JSON.parse(bridge.poll()) as { id: number; error?: string; retryable?: boolean; value?: unknown }[];
          for (const e of events) jobs.get(e.id)?.finish(e.error ? new AchievementError(e.error, `GameKit: ${e.error}`, e.retryable ?? false) : undefined, e.value);
        } catch (error) { for (const job of [...jobs.values()]) job.finish(error instanceof Error ? error : new Error(String(error))); }
      }, 50);
    },
    getSession() { refresh(); return { ...session }; }, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    load: (id, signal) => request('load', id, signal), report: (id, progress, signal) => request('report', id, signal, progress),
    showUI: (id, signal) => request('show', id, signal),
    dispose() { if (dead) return; dead = true; if (timer) clearInterval(timer); for (const job of [...jobs.values()]) job.finish(new AchievementError('disposed', 'Game Center disposed')); listeners.clear(); bridge.stop(); },
  };
}
