/** One non-consumable product per store instance. No secret keys belong here. */
export interface StoreConfig {
  productId: string;
  storageNamespace: string;
  androidPackage?: string;
  verificationUrl?: string;
  verificationPublicKey?: string;
}
export function validateStoreConfig(config: StoreConfig): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(config.productId)
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(config.storageNamespace)) throw Error('Invalid product or storage namespace');
  const verification = !!config.verificationUrl || !!config.verificationPublicKey;
  if (verification && (!/^https:\/\/[^\s]+$/.test(config.verificationUrl ?? '')
    || !config.verificationPublicKey?.includes('-----BEGIN PUBLIC KEY-----')
    || !/^[A-Za-z][\w]*(?:\.[A-Za-z][\w]*)+$/.test(config.androidPackage ?? ''))) throw Error('Incomplete Android verification configuration');
}
