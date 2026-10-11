import { assertToken, emptySnapshot, validateCatalog, validateSnapshot } from './catalog';
import { AchievementError } from './types';
import type { AchievementOptions, AchievementPort, AchievementSession, AchievementEvent, AchievementSnapshot,
  AchievementRecord, ReportReceipt, ProviderSession, ProviderContext } from './types';

interface SessionContext { session: AchievementSession; key: string; abort: AbortController; data: AchievementSnapshot | null }

export function createAchievements(options: AchievementOptions): AchievementController {
  return new AchievementController(options);
}

/** Single writer per storage namespace. Platform work is bounded and identity-fenced. */
export class AchievementController implements AchievementPort {
  readonly contractVersion = 1 as const;
  private readonly catalog;
  private readonly now;
  private readonly timeout;
  private current: SessionContext | null = null;
  private generation = 0;
  private disposed = false;
  private readonly lifetime = new AbortController();
  private initialized: Promise<void> | null = null;
  private tail: Promise<unknown> = Promise.resolve();
  private off: (() => void) | null = null;
  private readonly listeners = new Set<(event: AchievementEvent) => void>();

  constructor(private readonly options: AchievementOptions) {
    this.catalog = validateCatalog(options.catalog);
    assertToken(options.guestProfile, 'guestProfile'); assertToken(options.provider.applicationId, 'applicationId');
    this.now = options.clock ?? Date.now;
    this.timeout = options.operationTimeoutMs ?? 10000;
    if (!Number.isFinite(this.timeout) || this.timeout <= 0) throw new AchievementError('invalid-options', 'Invalid timeout');
  }
  getSession(): Readonly<AchievementSession> {
    return { ...(this.current?.session ?? { provider: this.options.provider.kind, state: 'unavailable', generation: 0 }) };
  }
  getCapabilities() { return { ...this.options.provider.capabilities }; }
  subscribe(listener: (event: AchievementEvent) => void): () => void {
    this.assertAlive(); this.listeners.add(listener); return () => this.listeners.delete(listener);
  }
  initialize(): Promise<void> {
    this.assertAlive();
    if (!this.initialized) {
      this.initialized = (async () => {
        this.off = this.options.provider.subscribe(() => {
          if (this.disposed) return;
          try { void this.adopt(this.options.provider.getSession()).catch(error => this.errorEvent(error)); }
          catch (error) { this.errorEvent(error); }
        });
        try {
          await this.bounded(() => this.options.provider.initialize(), this.lifetime.signal);
          this.assertAlive();
          await this.adopt(this.options.provider.getSession());
        } catch (error) { this.off?.(); this.off = null; throw error; }
      })();
    }
    return this.initialized;
  }
  reportProgress(id: string, value: number): Promise<ReportReceipt> {
    const context = this.context();
    const def = this.catalog.definitions.find(d => d.id === id);
    if (!def || !Number.isSafeInteger(value) || value < 0 || value > def.target) {
      return Promise.reject(new AchievementError('invalid-progress', 'Unknown ID or progress outside target'));
    }
    return this.serial(async () => {
      this.assertContext(context);
      const data = this.copy(context), record = this.record(data, id), previous = record.value;
      if (value <= previous) return this.receipt(context, record);
      record.value = value;
      const remote = this.options.provider.capabilities.remoteSync && !!context.session.playerId;
      record.pending = remote; record.sync = remote ? 'queued' : 'local-only';
      if (record.code === 'permanent' && remote) record.sync = 'failed';
      // New values do not clear a permanent provider error or bypass retry backoff.
      if (record.code && !record.pending) delete record.code;
      await this.persist(context, data);
      this.emit(context, { type: 'progress-changed', id, value, sync: record.sync });
      if (previous < def.target && value === def.target) this.emit(context, { type: 'unlocked-local', id, value });
      return this.receipt(context, record);
    });
  }
  unlock(id: string): Promise<ReportReceipt> {
    const def = this.catalog.definitions.find(d => d.id === id);
    if (!def) return Promise.reject(new AchievementError('invalid-progress', 'Unknown achievement'));
    return this.reportProgress(id, def.target);
  }
  /** Fetch provider state and reconcile monotonic progress; never turn guest records into account records. */
  load(): Promise<readonly AchievementRecord[]> {
    const context = this.context();
    return this.serial(() => this.reconcile(context));
  }
  private async reconcile(context: SessionContext): Promise<readonly AchievementRecord[]> {
      this.assertContext(context);
      if (context.session.state !== 'ready' || !this.options.provider.capabilities.query || !context.session.playerId) return this.copy(context).records;
      const remote = await this.bounded(signal => this.options.provider.load(this.providerContext(context, signal)), context.abort.signal);
      this.assertContext(context);
      const data = this.copy(context), ids = new Set<string>();
      for (const progress of remote) {
        const record = data.records.find(r => r.id === progress.id);
        if (!record || ids.has(progress.id) || !Number.isSafeInteger(progress.value) || progress.value < 0 || progress.value > data.targets[progress.id]) {
          throw new AchievementError('invalid-provider-data', 'Provider returned invalid progress');
        }
        ids.add(progress.id);
        record.platformValue = Math.max(record.platformValue, progress.value);
        record.value = Math.max(record.value, record.platformValue);
        if (record.platformValue >= record.value) {
          record.pending = false; record.sync = 'reconciled'; record.attempts = 0; record.retryAt = 0; delete record.code;
        }
      }
      await this.persist(context, data);
      this.emit(context, { type: 'sync-changed' });
      return this.copy(context).records;
  }
  /** Explicit batch boundary. Call on meaningful checkpoints/connectivity changes, never every frame. */
  flush(): Promise<readonly AchievementRecord[]> {
    const context = this.context();
    return this.serial(async () => {
      this.assertContext(context);
      await this.reconcile(context);
      const data = this.copy(context);
      if (!this.options.provider.capabilities.remoteSync || !context.session.playerId || context.session.state !== 'ready') return data.records;
      const batch = data.records.filter(r => {
        const def = this.catalog.definitions.find(d => d.id === r.id)!;
        return r.pending && r.retryAt <= this.now() && r.code !== 'permanent' && (!def.hidden || r.value === def.target);
      });
      if (batch.length === 0) return data.records;
      try {
        await this.bounded(signal => this.options.provider.report(batch.map(r => ({ id: r.id, value: r.value })), this.providerContext(context, signal)), context.abort.signal);
        this.assertContext(context);
        for (const record of batch) {
          // Keep an intent until a querying provider reads it back. SDK acceptance can precede persistence.
          record.pending = this.options.provider.capabilities.query;
          record.sync = 'provider-accepted'; record.attempts = 0;
          record.retryAt = record.pending ? this.now() + 5000 : 0; delete record.code;
        }
      } catch (error) {
        this.assertContext(context);
        const retryable = error instanceof AchievementError ? error.retryable : true;
        for (const record of batch) {
          record.attempts = Math.min(record.attempts + 1, 30); record.sync = 'failed';
          record.code = retryable ? 'retryable' : 'permanent';
          record.retryAt = retryable ? this.now() + Math.min(300000, 1000 * 2 ** Math.min(record.attempts - 1, 9)) : 0;
        }
        await this.persist(context, data);
        this.emit(context, { type: 'error', code: error instanceof AchievementError ? error.code : 'provider-failed' });
        return this.copy(context).records;
      }
      await this.persist(context, data);
      this.emit(context, { type: 'sync-changed' });
      return this.copy(context).records;
    });
  }
  async showUI(): Promise<'shown' | 'unsupported'> {
    const context = this.context();
    if (!this.options.provider.capabilities.nativeUI || !this.options.provider.showUI) return 'unsupported';
    return this.serial(async () => {
      this.assertContext(context);
      if (context.session.state !== 'ready') throw new AchievementError('not-authenticated', 'Platform UI needs a ready session');
      await this.bounded(signal => this.options.provider.showUI!(this.providerContext(context, signal)), context.abort.signal);
      this.assertContext(context); return 'shown' as const;
    });
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.lifetime.abort(); this.current?.abort.abort(); this.off?.(); this.off = null;
    this.listeners.clear(); this.options.provider.dispose();
  }
  private adopt(session: ProviderSession): Promise<void> {
    this.assertAlive();
    if (!['guest', 'authenticating', 'ready', 'offline', 'unavailable'].includes(session.state) ||
      (this.options.provider.capabilities.remoteSync && session.state === 'ready' && !session.playerId) ||
      (session.playerId !== undefined && (typeof session.playerId !== 'string' || session.playerId.length === 0))) {
      throw new AchievementError('invalid-session', 'Invalid provider identity');
    }
    const old = this.current;
    if (old && old.session.state === session.state && old.session.playerId === session.playerId) return this.tail.then(() => {});
    old?.abort.abort();
    const identity = session.playerId ? ['player', session.playerId] : ['guest', this.options.guestProfile];
    const context: SessionContext = { session: { ...session, provider: this.options.provider.kind, generation: ++this.generation },
      key: JSON.stringify(['achievements-v1', this.catalog.gameId, this.catalog.environment, this.options.provider.kind, this.options.provider.applicationId, ...identity]),
      abort: new AbortController(), data: null };
    this.current = context;
    return this.serial(async () => {
      this.assertContext(context);
      const stored = await this.options.storage.read(context.key); this.assertContext(context);
      let data: AchievementSnapshot;
      if (stored === null) data = emptySnapshot(this.catalog);
      else {
        try { data = validateSnapshot(stored, this.catalog); }
        catch (error) {
          if (!this.options.migrate) throw error;
          data = validateSnapshot(this.options.migrate(stored, this.catalog), this.catalog);
          await this.options.storage.write(context.key, data); this.assertContext(context);
        }
      }
      context.data = data; this.emit(context, { type: 'session-changed' });
    });
  }
  private context(): SessionContext {
    this.assertAlive();
    if (!this.current) throw new AchievementError('not-initialized', 'Await initialize() first');
    return this.current;
  }
  private assertAlive() { if (this.disposed) throw new AchievementError('disposed', 'Achievements disposed'); }
  private assertContext(context: SessionContext) {
    this.assertAlive();
    if (this.current !== context || context.abort.signal.aborted) throw new AchievementError('session-changed', 'Achievement session changed');
    const actual = this.options.provider.getSession();
    if (actual.playerId !== context.session.playerId || actual.state !== context.session.state) throw new AchievementError('session-changed', 'Provider identity changed');
  }
  private copy(context: SessionContext): AchievementSnapshot {
    if (!context.data) throw new AchievementError('storage-unavailable', 'Session storage has not loaded');
    return JSON.parse(JSON.stringify(context.data));
  }
  private record(data: AchievementSnapshot, id: string) { return data.records.find(r => r.id === id)!; }
  private receipt(context: SessionContext, record: AchievementRecord): ReportReceipt {
    return { id: record.id, state: record.sync, sessionGeneration: context.session.generation, ...(record.code ? { code: record.code } : {}) };
  }
  private async persist(context: SessionContext, data: AchievementSnapshot) {
    this.assertContext(context);
    await this.options.storage.write(context.key, data);
    this.assertContext(context); context.data = data;
  }
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tail.then(fn); this.tail = next.catch(() => {}); return next;
  }
  private providerContext(context: SessionContext, signal: AbortSignal): ProviderContext { return { session: { ...context.session }, signal }; }
  private emit(context: SessionContext, value: Omit<AchievementEvent, 'session' | 'profileKey'>) {
    if (this.disposed || this.current !== context) return;
    for (const listener of [...this.listeners]) {
      if (this.disposed || this.current !== context) break;
      try { listener({ ...value, session: { ...context.session }, profileKey: context.key }); }
      catch { /* A consumer listener cannot roll back durable state or stop other listeners. */ }
    }
  }
  private errorEvent(error: unknown) {
    if (this.current) this.emit(this.current, { type: 'error', code: error instanceof AchievementError ? error.code : 'storage-failed' });
  }
  private bounded<T>(run: (signal: AbortSignal) => Promise<T>, parent: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
      const abort = new AbortController(); let done = false;
      const finish = (error: unknown, value?: T) => {
        if (done) return; done = true; clearTimeout(timer); parent.removeEventListener('abort', cancel);
        if (error) { abort.abort(); reject(error); } else resolve(value as T);
      };
      const cancel = () => finish(new AchievementError('session-changed', 'Session cancelled'));
      const timer = setTimeout(() => finish(new AchievementError('timeout', 'Provider operation timed out', true)), this.timeout);
      parent.addEventListener('abort', cancel, { once: true });
      if (parent.aborted) { cancel(); return; }
      Promise.resolve().then(() => run(abort.signal)).then(value => finish(null, value), error => finish(error));
    });
  }
}
