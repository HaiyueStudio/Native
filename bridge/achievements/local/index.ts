import type { AchievementProvider } from '../core/types';

/** Local progress is persisted by the controller's injected storage, never reported remotely. */
export function createLocalAchievementProvider(applicationId: string): AchievementProvider {
  return {
    kind: 'local', applicationId,
    capabilities: { authentication: false, query: false, persistentProgress: true, nativeUI: false, remoteSync: false },
    async initialize() {}, getSession: () => ({ state: 'guest' }),
    subscribe: () => () => {}, async load() { return []; }, async report() {}, dispose() {},
  };
}
