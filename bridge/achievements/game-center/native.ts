import type { GameCenterAchievementClient } from './index';
/** Platform resolver selects native.ios.ts in NativeScript. Other targets use local mode. */
export function createNativeGameCenterClient(): GameCenterAchievementClient { throw new Error('Game Center requires the iOS implementation; use local on Android/Web'); }
