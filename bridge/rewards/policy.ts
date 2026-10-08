/** This adapter only requests non-personalized ads. ATT is independent of UMP.
 * Policy must be identical for all gateways in one process (SDK settings are global). */
export interface AdMobPolicy {
  maxAdContentRating: 'G' | 'PG' | 'T' | 'MA';
  ageTreatment: 'unspecified' | 'child' | 'teen';
  underAgeOfConsent: boolean;
  /** iOS only. `system` requests Apple's ATT alert after regional consent, without a custom explainer.
   * The host must provide a localized NSUserTrackingUsageDescription. */
  iosTrackingAuthorization?: 'none' | 'system';
}
export function resolveAdMobPolicy(policy?: Partial<AdMobPolicy>): AdMobPolicy {
  const value = { maxAdContentRating: 'G' as const, underAgeOfConsent: false, ageTreatment: 'unspecified' as const, iosTrackingAuthorization: 'none' as const, ...policy };
  if (!['G', 'PG', 'T', 'MA'].includes(value.maxAdContentRating)
    || typeof value.underAgeOfConsent !== 'boolean'
    || !['unspecified', 'child', 'teen'].includes(value.ageTreatment)
    || !['none', 'system'].includes(value.iosTrackingAuthorization)) throw Error('Invalid AdMob policy');
  return value;
}
