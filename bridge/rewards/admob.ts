import { Application, Connectivity, isAndroid, isIOS } from '@nativescript/core';
import { isNativeDebugBuild } from './development';
import { resolveAdMobPolicy, type AdMobPolicy } from './policy';
import { RewardError, rewardErrorFromEvent, type RewardFailure, type RewardFailureCode, type RewardFailureStage } from './errors';
import type { RewardGateway, RewardPresentation } from './controller';

declare const HYRewardedAds: { new(): { configurePolicy(policy: string): boolean; privacyRequired: boolean; consentRequired: boolean; continuePresentation(ready: boolean): void; performUnitEvents(action: string, unit: string, events: (event: string) => void): void; dispose(): void } };
declare const org: any;
/** Platform adapter is lazy: paid users and players who never opt in make no ad requests. */
export class AdMobRewardGateway implements RewardGateway {
  private native: any;
  private disposed = false;
  private initialization?: Promise<void>;
  private readonly policy: AdMobPolicy;
  private readonly development = isNativeDebugBuild();
  constructor(private readonly config: { iosUnit: string; androidUnit: string; development?: boolean; policy?: Partial<AdMobPolicy>; onFailure?: (failure: RewardFailure) => void }) {
    this.policy = resolveAdMobPolicy(config.policy);
  }
  private getNative(): any {
    if (!this.native) {
      const native = isAndroid ? new org.haiyue.rewards.HYRewardedAds() : new HYRewardedAds();
      if (!native.configurePolicy(JSON.stringify(this.policy))) { native.dispose(); throw this.failure('configuration', 'policy_rejected'); }
      this.native = native;
    }
    return this.native;
  }
  privacyRequired(): boolean {
    if (this.disposed) return false;
    try {
      const native = this.getNative();
      return isAndroid ? native.privacyRequired(Application.android.context) : native.privacyRequired;
    } catch { return false; }
  }
  private failure(stage: RewardFailureStage, code: RewardFailureCode, phase = 'unavailable'): Error {
    return rewardErrorFromEvent(`error:${phase}:${JSON.stringify({ stage, code })}`, isIOS ? 'ios' : 'android', '', Date.now());
  }
  private async call(action: string, earned: () => void, presentation?: RewardPresentation): Promise<void> {
    const startedAt = Date.now();
    try { await this.execute(action, earned, presentation); }
    catch (error) {
      const details = error instanceof RewardError ? error.failure : { stage: 'unknown', code: 'bridge_error' };
      const failure = rewardErrorFromEvent(`error:${error instanceof RewardError ? error.failure.phase : 'unavailable'}:${JSON.stringify(details)}`, isIOS ? 'ios' : 'android', action, startedAt);
      // A host logging/storage failure must never change ad settlement or wallet results.
      try { this.config.onFailure?.(failure.failure); } catch { /* Diagnostics are best effort. */ }
      throw failure;
    }
  }
  private async execute(action: string, earned: () => void, presentation?: RewardPresentation): Promise<void> {
    if (this.disposed) throw this.failure('lifecycle', 'disposed');
    if (Connectivity.getConnectionType() === Connectivity.connectionType.none) throw this.failure('configuration', 'network', 'offline');
    const unit = this.development
      ? (isIOS ? 'ca-app-pub-3940256099942544/1712485313' : 'ca-app-pub-3940256099942544/5224354917')
      : (isIOS ? this.config.iosUnit : this.config.androidUnit);
    if (action === 'show' && (!/^ca-app-pub-\d{16}\/\d{10}$/.test(unit) || (!this.development && unit.includes('3940256099942544')))) throw this.failure('configuration', 'invalid_unit');
    this.getNative();
    await new Promise<void>((resolve, reject) => {
      let ended = false, preparing = false;
      const onEvent = (event: string) => {
        if (ended) return;
        if (this.development) console.log('[haiyue-rewards]', event);
        if (event === 'earned') { earned(); return; }
        if (event === 'presenting') {
          if (preparing) return;
          preparing = true;
          void (async () => {
            let ready = false;
            try { ready = presentation ? await presentation.prepare() : true; } catch { /* Tell native to cancel safely. */ }
            if (!ended) this.native.continuePresentation(ready && !this.disposed);
          })();
          return;
        }
        if (event === 'presentation-closed') { preparing = false; presentation?.closed(); return; }
        ended = true;
        presentation?.closed();
        if (event === 'closed') resolve(); else reject(rewardErrorFromEvent(event, isIOS ? 'ios' : 'android', action, Date.now()));
      };
      if (isAndroid) {
        const activity = Application.android.foregroundActivity;
        if (!activity) { reject(this.failure('lifecycle', 'no_presenter')); return; }
        this.native.perform(activity, action, unit, new org.haiyue.rewards.HYRewardedAds.Events({ onEvent }));
      } else this.native.performUnitEvents(action, unit, onEvent);
    });
  }
  async show(earned: () => void, presentation?: RewardPresentation): Promise<void> {
    // The native gateway accepts one operation at a time. An explicit request
    // retries even if the background startup refresh failed.
    if (this.initialization) await this.initialization.catch(() => {});
    return this.call('show', earned, presentation);
  }
  /** Update consent once per host session, without initializing or preloading ads. */
  initialize(presentForm: boolean, beforePresent: () => Promise<boolean>): Promise<void> {
    if (!isIOS) return Promise.resolve();
    return this.initialization ??= this.initializeConsent(presentForm, beforePresent);
  }
  private async initializeConsent(presentForm: boolean, beforePresent: () => Promise<boolean>): Promise<void> {
    await this.call('refreshPrivacy', () => {});
    if (!this.disposed && presentForm && this.getNative().consentRequired) {
      await this.call('presentConsent', () => {}, { prepare: beforePresent, closed() {} });
    }
  }
  async privacy(presentation?: RewardPresentation): Promise<void> {
    if (this.initialization) await this.initialization.catch(() => {});
    return this.call('privacy', () => {}, presentation);
  }
  dispose(): void { this.disposed = true; this.native?.dispose(); }
}
