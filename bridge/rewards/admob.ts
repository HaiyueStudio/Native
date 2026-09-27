import { Application, Connectivity, isAndroid, isIOS } from '@nativescript/core';
import { isNativeDebugBuild } from './development';
import { resolveAdMobPolicy, type AdMobPolicy } from './policy';
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
  constructor(private readonly config: { iosUnit: string; androidUnit: string; development?: boolean; policy?: Partial<AdMobPolicy> }) {
    this.policy = resolveAdMobPolicy(config.policy);
  }
  private getNative(): any {
    if (!this.native) {
      const native = isAndroid ? new org.haiyue.rewards.HYRewardedAds() : new HYRewardedAds();
      if (!native.configurePolicy(JSON.stringify(this.policy))) { native.dispose(); throw Error('unavailable'); }
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
  private async call(action: string, earned: () => void, presentation?: RewardPresentation): Promise<void> {
    if (this.disposed) throw Error('unavailable');
    if (Connectivity.getConnectionType() === Connectivity.connectionType.none) throw Error('offline');
    const unit = this.development
      ? (isIOS ? 'ca-app-pub-3940256099942544/1712485313' : 'ca-app-pub-3940256099942544/5224354917')
      : (isIOS ? this.config.iosUnit : this.config.androidUnit);
    if (action === 'show' && (!/^ca-app-pub-\d{16}\/\d{10}$/.test(unit) || (!this.development && unit.includes('3940256099942544')))) throw Error('unavailable');
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
        if (event === 'closed') resolve(); else reject(Error(event.split(':')[1] || 'unavailable'));
      };
      if (isAndroid) {
        const activity = Application.android.foregroundActivity;
        if (!activity) { reject(Error('unavailable')); return; }
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
