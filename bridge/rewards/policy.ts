/** This adapter only requests non-personalized ads and never requests ATT permission.
 * Policy must be identical for all gateways in one process (SDK settings are global). */
export interface AdMobPolicy {
  maxAdContentRating: 'G' | 'PG' | 'T' | 'MA';
  ageTreatment: 'unspecified' | 'child' | 'teen';
  underAgeOfConsent: boolean;
}
export function resolveAdMobPolicy(policy?: Partial<AdMobPolicy>): AdMobPolicy {
  const value = { maxAdContentRating: 'G' as const, underAgeOfConsent: false, ageTreatment: 'unspecified' as const, ...policy };
  if (!['G', 'PG', 'T', 'MA'].includes(value.maxAdContentRating)
    || typeof value.underAgeOfConsent !== 'boolean'
    || !['unspecified', 'child', 'teen'].includes(value.ageTreatment)) throw Error('Invalid AdMob policy');
  return value;
}
