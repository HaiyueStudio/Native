import { ApplicationSettings } from '@nativescript/core';
import { RewardController } from './controller';
import { AdMobRewardGateway } from './admob';
import type { RewardFailure } from './errors';
import type { AdMobPolicy } from './policy';
export interface RewardsConfig {
  storageNamespace: string;
  /** Credits granted by each valid rewarded event; default 1. */
  rewardAmount?: number;
  dailyFree: number;
  dailyAds: number;
  iosUnit: string;
  androidUnit: string;
  /** Deprecated: the native build determines debug mode. */
  development?: boolean;
  policy?: Partial<AdMobPolicy>;
  /** Receives sanitized diagnostics in Debug and Release. Host owns persistence/retention. */
  onFailure?: (failure: RewardFailure) => void;
}
/** Own one wallet/gateway per feature; dispose it when its host is destroyed. */
export function createRewards(config: RewardsConfig, hooks: {
  entitled(): boolean;
  pause(): (() => void) | Promise<() => void>;
}): RewardController {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(config.storageNamespace)) throw Error('Invalid reward storage namespace');
  const key = `${config.storageNamespace}.reward-wallet`;
  return new RewardController({ ...config, ...hooks,
    gateway: new AdMobRewardGateway(config),
    storage: {
      read: () => ApplicationSettings.getString(key) ?? null,
      write: value => {
        ApplicationSettings.setString(key, value);
        if (!ApplicationSettings.flush()) throw Error('Reward wallet could not be saved');
      },
    },
  });
}

export { isNativeDebugBuild } from './development';
