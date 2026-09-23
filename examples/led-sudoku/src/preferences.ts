import { Device } from '@nativescript/core';
import { NativeSettingsStorage } from '../../../bridge/storage/settings-storage';
import { preferences, type Preferences } from '../../../../Games/games/led-sudoku/preferences';
const storage = new NativeSettingsStorage('led-sudoku-preferences:');
export function readPreferences(): Preferences {
  try { return preferences(JSON.parse(storage.getItem('ui') ?? '{}'), Device.language); } catch { return preferences({}, Device.language); }
}
export function writePreferences(value: Preferences): void { storage.setItem('ui', JSON.stringify(preferences(value))); }

const statsStorage = new NativeSettingsStorage('led-sudoku-statistics:');
export function readStatistics(): unknown { return JSON.parse(statsStorage.getItem('completed') ?? 'null'); }
export function writeStatistics(value: import('../../../../Games/games/led-sudoku/statistics').SudokuStatistics): void {
  statsStorage.setItem('completed', JSON.stringify(value));
}
