# Non-consumable purchases

Public neutral entry: `@haiyue/native/purchases`. Native factory: `@haiyue/native/purchases/native`.

See [integration](../monetization/README.md) for build wiring, UI mapping and supported scope.

- `StoreConfig`: product ID, storage namespace, optional Android package/HTTPS verification URL/public key. No service account or private key in the app.
- `NativeStore`: platform gateway. iOS accepts only StoreKit-verified non-consumable transactions; explicit restore synchronizes, then rereads current entitlements even after a transient sync failure. Cancellation remains cancellation. Android verifies scoped, signed leases from the server.
- `PurchaseController`: serializes purchase/restore/refresh, coalesces transaction notifications, publishes busy/loading synchronously, preserves verified access during transient failures and enforces Android lease expiry when read. It does not grant access from UI booleans or purchase callbacks alone.
- `dispose()` detaches listeners and settles outstanding JavaScript bridge calls. Late native replies cannot update a disposed controller. Checkout has no JavaScript timeout that would enable a duplicate checkout while system UI is active.
- Android storage keys contain the namespace and product; leases bind package, product, installation, token hash and expiry. A successfully empty/pending inventory clears previous account access, even if the verifier is down. A different purchase token cannot borrow the cached grant.
- Restored ownership is platform store-account ownership; there is no cross-iOS/Android account mapping, RTDN service or consumable ledger.
