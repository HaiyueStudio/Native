import { isIOS } from '@nativescript/core';
import config from '../achievements.json';
import { createGameCenterAchievementProvider } from '../../../bridge/achievements/game-center/index';
import { createNativeGameCenterClient } from '../../../bridge/achievements/game-center/native';
import { rubikAchievementCatalog } from '../../achievements-validation/shared/rubik';
/** App-owned opt-in. Android and the unconfigured public example remain local. */
export function achievementProvider() {
  if (!isIOS || config.provider === 'local') return undefined;
  if (config.provider !== 'game-center') throw new Error('Unsupported achievement distribution');
  return createGameCenterAchievementProvider({ bundleId: config.bundleId, catalog: rubikAchievementCatalog, client: createNativeGameCenterClient() });
}
