import * as settings from '@nativescript/core/application-settings';
/** Scoped persistent Storage port for Engine's injectable LocalStorageSaveBackend. */
export class NativeSettingsStorage implements Storage {
  constructor(private readonly prefix = 'haiyue-game:') {}
  private keys(): string[] { return settings.getAllKeys().filter(key => key.startsWith(this.prefix)).sort(); }
  get length(): number { return this.keys().length; }
  key(index: number): string | null { return this.keys()[index]?.slice(this.prefix.length) ?? null; }
  getItem(key: string): string | null { return settings.hasKey(this.prefix + key) ? settings.getString(this.prefix + key) : null; }
  setItem(key: string, value: string): void { settings.setString(this.prefix + key, String(value)); settings.flush(); }
  removeItem(key: string): void { settings.remove(this.prefix + key); settings.flush(); }
  clear(): void { for (const key of this.keys()) settings.remove(key); settings.flush(); }
}
