import { createHash } from 'node:crypto';
import type { AchievementSnapshot, AchievementStorage } from '../../bridge/achievements/core/types';

export function applicationDataDirectory(gameId: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(gameId)) throw new Error('Invalid application ID');
  if (Deno.build.os === 'windows') {
    const base = Deno.env.get('LOCALAPPDATA'); if (!base) throw new Error('LOCALAPPDATA is unavailable');
    return `${base}/Haiyue/${gameId}`;
  }
  const base = Deno.env.get('HOME'); if (!base) throw new Error('HOME is unavailable');
  return `${base}/Library/Application Support/Haiyue/${gameId}`;
}

/** Single process writer. File + rename prevents partial JSON after a crash. */
export class DesktopStorage implements AchievementStorage, Storage {
  constructor(readonly directory: string) { Deno.mkdirSync(directory, { recursive: true }); }
  private filename(key: string): string {
    // A fixed-length hash avoids path traversal and OS filename length limits.
    return `${this.directory}/${createHash('sha256').update(key).digest('hex')}.entry.json`;
  }
  private decode(text: string): { key: string; value: string } {
    const data = JSON.parse(text);
    if (data?.format !== 'haiyue-desktop-storage-v1' || typeof data.key !== 'string' || typeof data.value !== 'string') throw new Error('Invalid desktop storage entry');
    return data;
  }
  private keys(): string[] {
    const keys: string[] = [];
    for (const entry of Deno.readDirSync(this.directory)) {
      if (!entry.isFile || !/^[a-f0-9]{64}\.entry\.json$/.test(entry.name)) continue;
      const path = `${this.directory}/${entry.name}`, data = this.decode(Deno.readTextFileSync(path));
      if (this.filename(data.key) !== path) throw new Error('Desktop storage key checksum mismatch');
      keys.push(data.key);
    }
    return keys.sort();
  }
  get length(): number { return this.keys().length; }
  key(index: number): string | null { return this.keys()[index] ?? null; }
  clear(): void { for (const key of this.keys()) this.removeItem(key); }
  getItem(key: string): string | null {
    try {
      const entry = this.decode(Deno.readTextFileSync(this.filename(key)));
      if (entry.key !== key) throw new Error('Desktop storage key mismatch');
      return entry.value;
    } catch (error) { if (error instanceof Deno.errors.NotFound) return null; throw error; }
  }
  setItem(key: string, value: string): void {
    const filename = this.filename(key), temporary = `${filename}.${crypto.randomUUID()}.tmp`;
    try {
      const file = Deno.openSync(temporary, { write: true, createNew: true });
      try { const bytes = new TextEncoder().encode(JSON.stringify({ format: 'haiyue-desktop-storage-v1', key, value })); let offset = 0; while (offset < bytes.length) offset += file.writeSync(bytes.subarray(offset)); file.syncSync(); }
      finally { file.close(); }
      Deno.renameSync(temporary, filename);
    } finally { try { Deno.removeSync(temporary); } catch (error) { if (!(error instanceof Deno.errors.NotFound)) throw error; } }
  }
  removeItem(key: string): void { try { Deno.removeSync(this.filename(key)); } catch (error) { if (!(error instanceof Deno.errors.NotFound)) throw error; } }
  async read(key: string): Promise<unknown | null> { const value = this.getItem(key); return value === null ? null : JSON.parse(value); }
  async write(key: string, snapshot: AchievementSnapshot): Promise<void> { this.setItem(key, JSON.stringify(snapshot)); }
}
