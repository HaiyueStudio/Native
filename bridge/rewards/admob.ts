import { Application, Connectivity, isAndroid, isIOS } from '@nativescript/core';
import type { RewardGateway, RewardPresentation } from './controller';

declare const HYRewardedAds: { new(): { privacyRequired: boolean; consentRequired: boolean; continuePresentation(ready: boolean): void; performUnitEvents(action: string, unit: string, events: (event: string) => void): void; dispose(): void } };
declare const org: any;
/** Platform adapter is lazy: paid users and players who never opt in make no ad requests. */
export class AdMobRewardGateway implements RewardGateway {
  private native: any;
  private disposed = false;
  private initialization?: Promise<void>;
  constructor(private readonly config: { iosUnit: string; androidUnit: string; development: boolean }) {}
  private getNative(): any {
    return this.native ??= isAndroid ? new org.haiyue.rewards.HYRewardedAds() : new HYRewardedAds();
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
    const unit = this.config.development
      ? (isIOS ? 'ca-app-pub-3940256099942544/1712485313' : 'ca-app-pub-3940256099942544/5224354917')
      : (isIOS ? this.config.iosUnit : this.config.androidUnit);
    if (action === 'show' && (!unit || (!this.config.development && unit.includes('3940256099942544')))) throw Error('unavailable');
    this.getNative();
    await new Promise<void>((resolve, reject) => {
      let ended = false, preparing = false;
      const onEvent = (event: string) => {
        if (ended) return;
        if (this.config.development) console.log('[haiyue-rewards]', event);
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
