/** Public configuration only. Never put service-account or signing private keys in the app. */
export const CALENDAR_STORE = {
  productId: 'calendar_puzzle_full_unlock',
  androidPackage: 'org.haiyue.games.calendarpuzzle',
  // Populate after deploying Native/services/calendar-entitlements.
  verificationUrl: '',
  // PEM SubjectPublicKeyInfo from the verification server's RSA signing key.
  verificationPublicKey: '',
} as const;
