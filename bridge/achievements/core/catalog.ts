import { AchievementError, type AchievementCatalog, type AchievementSnapshot } from './types';

export function assertToken(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256 || /[\u0000-\u001f]/.test(value)) {
    throw new AchievementError('invalid-catalog', `Invalid ${label}`);
  }
}
export function validateCatalog(input: AchievementCatalog): AchievementCatalog {
  if (input.schemaVersion !== 1 || !Array.isArray(input.definitions) || input.definitions.length > 1000) {
    throw new AchievementError('invalid-catalog', 'Expected schema 1 and at most 1000 definitions');
  }
  for (const key of ['gameId', 'environment', 'version'] as const) assertToken(input[key], key);
  const ids = new Set<string>(), steam = new Set<string>(), apple = new Set<string>();
  for (const def of input.definitions) {
    assertToken(def.id, 'achievement id');
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(def.id) || ['__proto__', 'constructor', 'prototype'].includes(def.id) || ids.has(def.id)) {
      throw new AchievementError('invalid-catalog', `Duplicate or unsafe achievement id: ${def.id}`);
    }
    ids.add(def.id);
    if (!Number.isSafeInteger(def.target) || def.target <= 0 || (def.platform?.steam?.progressStat && def.target > 2147483647)) {
      throw new AchievementError('invalid-catalog', `Invalid target: ${def.id}`);
    }
    assertToken(def.titleKey, 'titleKey'); assertToken(def.descriptionKey, 'descriptionKey');
    if (def.iconKey !== undefined) assertToken(def.iconKey, 'iconKey');
    if (def.hidden !== undefined && typeof def.hidden !== 'boolean') throw new AchievementError('invalid-catalog', 'hidden must be boolean');
    if (def.platform?.steam?.progressStat !== undefined) assertToken(def.platform.steam.progressStat, 'Steam progress stat');
    for (const [mapping, names] of [[def.platform?.steam, steam], [def.platform?.gameCenter, apple]] as const) {
      if (mapping) {
        assertToken(mapping.achievementId, 'platform achievement id');
        if (names.has(mapping.achievementId)) throw new AchievementError('invalid-catalog', 'Duplicate platform mapping');
        names.add(mapping.achievementId);
      }
    }
  }
  return JSON.parse(JSON.stringify(input));
}
export function emptySnapshot(catalog: AchievementCatalog): AchievementSnapshot {
  return { schemaVersion: 1, catalogVersion: catalog.version,
    targets: Object.fromEntries(catalog.definitions.map(d => [d.id, d.target])),
    records: catalog.definitions.map(d => ({ id: d.id, value: 0, platformValue: 0, sync: 'local-only', pending: false, attempts: 0, retryAt: 0 })) };
}
export function validateSnapshot(value: unknown, catalog: AchievementCatalog): AchievementSnapshot {
  const data = value as AchievementSnapshot;
  const expected = emptySnapshot(catalog);
  if (!data || data.schemaVersion !== 1 || data.catalogVersion !== catalog.version || !data.targets || !Array.isArray(data.records) ||
      Object.keys(data.targets).length !== catalog.definitions.length || data.records.length !== catalog.definitions.length) {
    throw new AchievementError('migration-required', 'Snapshot schema/catalog differs; explicit migration required');
  }
  const ids = new Set<string>();
  for (const record of data.records) {
    const target = expected.targets[record.id];
    if (!Object.hasOwn(expected.targets, record.id) || ids.has(record.id) || data.targets[record.id] !== target) {
      throw new AchievementError('migration-required', 'Snapshot definition or target changed');
    }
    ids.add(record.id);
    if (![record.value, record.platformValue, record.attempts, record.retryAt].every(v => Number.isSafeInteger(v) && v >= 0) ||
        record.value > target || record.platformValue > target || typeof record.pending !== 'boolean' ||
        !['local-only', 'queued', 'provider-accepted', 'reconciled', 'failed'].includes(record.sync) ||
        (record.code !== undefined && typeof record.code !== 'string')) {
      throw new AchievementError('invalid-storage', 'Invalid achievement record');
    }
  }
  return JSON.parse(JSON.stringify(data));
}
