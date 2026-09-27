import { PurchaseController } from './controller';
import { NativeStore } from './store';
import type { StoreConfig } from './config';
export { NativeStore } from './store';
export function createPurchases(config: StoreConfig): PurchaseController {
  return new PurchaseController(new NativeStore(config));
}
