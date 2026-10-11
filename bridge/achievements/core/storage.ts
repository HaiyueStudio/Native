import type { AchievementStorage } from './types';

/** Adapter for Web Storage or a native string settings store with atomic setItem. */
export function createAchievementStorage(storage: {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}, prefix = 'haiyue-achievements:'): AchievementStorage {
  return {
    async read(key) { const value = storage.getItem(prefix + key); return value === null ? null : JSON.parse(value); },
    async write(key, value) { storage.setItem(prefix + key, JSON.stringify(value)); },
  };
}
