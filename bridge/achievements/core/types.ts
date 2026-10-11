export type ProviderKind = 'local' | 'steam' | 'game-center';
export type SyncState = 'local-only' | 'queued' | 'provider-accepted' | 'reconciled' | 'failed';
export interface AchievementDefinition {
  id: string;
  target: number;
  titleKey: string;
  descriptionKey: string;
  iconKey?: string;
  hidden?: boolean;
  platform?: {
    steam?: { achievementId: string; progressStat?: string };
    gameCenter?: { achievementId: string };
  };
}
export interface AchievementCatalog {
  schemaVersion: 1;
  gameId: string;
  environment: string;
  version: string;
  definitions: readonly AchievementDefinition[];
}
export interface ProviderSession {
  state: 'guest' | 'authenticating' | 'ready' | 'offline' | 'unavailable';
  playerId?: string;
}
export interface AchievementSession extends ProviderSession {
  provider: ProviderKind;
  generation: number;
}
export interface AchievementCapabilities {
  authentication: boolean;
  query: boolean;
  persistentProgress: boolean;
  nativeUI: boolean;
  remoteSync: boolean;
}
export interface ProviderContext {
  session: Readonly<AchievementSession>;
  signal: AbortSignal;
}
export interface ProviderProgress { id: string; value: number }
export interface AchievementProvider {
  readonly kind: ProviderKind;
  /** Steam App ID, Apple bundle/app identity, or explicit local application ID. */
  readonly applicationId: string;
  readonly capabilities: Readonly<AchievementCapabilities>;
  initialize(): Promise<void>;
  getSession(): ProviderSession;
  subscribe(listener: () => void): () => void;
  /** Provider must verify the expected player immediately before SDK calls. */
  load(context: ProviderContext): Promise<readonly ProviderProgress[]>;
  /** Success means SDK acceptance, not cloud durability. Absolute values only. */
  report(progress: readonly ProviderProgress[], context: ProviderContext): Promise<void>;
  showUI?(context: ProviderContext): Promise<void>;
  dispose(): void;
}
export interface AchievementStorage {
  read(key: string): Promise<unknown | null>;
  /** Atomic replacement. Resolve only after the replacement is persisted. */
  write(key: string, snapshot: AchievementSnapshot): Promise<void>;
}
export interface AchievementRecord {
  id: string;
  value: number;
  platformValue: number;
  sync: SyncState;
  pending: boolean;
  attempts: number;
  retryAt: number;
  code?: string;
}
export interface AchievementSnapshot {
  schemaVersion: 1;
  catalogVersion: string;
  targets: Record<string, number>;
  records: AchievementRecord[];
}
export interface ReportReceipt {
  id: string;
  sessionGeneration: number;
  state: SyncState;
  code?: string;
}
export interface AchievementPort {
  readonly contractVersion: 1;
  reportProgress(id: string, absoluteValue: number): Promise<ReportReceipt>;
  unlock(id: string): Promise<ReportReceipt>;
}
export interface AchievementEvent {
  type: 'session-changed' | 'progress-changed' | 'unlocked-local' | 'sync-changed' | 'error';
  session: Readonly<AchievementSession>;
  profileKey: string;
  id?: string;
  value?: number;
  sync?: SyncState;
  code?: string;
}
export interface AchievementOptions {
  catalog: AchievementCatalog;
  provider: AchievementProvider;
  storage: AchievementStorage;
  guestProfile: string;
  clock?: () => number;
  operationTimeoutMs?: number;
  /** Explicit catalog/storage migration; result is validated before atomic save. */
  migrate?: (stored: unknown, catalog: AchievementCatalog) => AchievementSnapshot;
}
export class AchievementError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryable = false) {
    super(message); this.name = 'AchievementError';
  }
}
