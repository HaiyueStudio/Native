# Calendar Puzzle Google Play entitlement verification

Node.js 22+, no npm dependencies. This service verifies the app's single non-consumable product with the Google Play Developer API, acknowledges valid purchases, and returns a signed, scoped entitlement. It never consumes purchases. iOS uses verified StoreKit 2 transactions directly and does not call this service.

## Deployment

1. Create/enable Google Play Android Developer API credentials. Grant the service account access to **this app** in Play Console and permissions to view orders and manage purchases. Keep the JSON key in your secret manager.
2. Generate a dedicated RSA key pair in a private directory outside source control:

   ```sh
   openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out calendar-entitlement-private.pem
   openssl pkey -in calendar-entitlement-private.pem -pubout -out calendar-entitlement-public.pem
   ```

3. Set the environment variables in `.env.example` using the deployment platform's secret injection. `node server.mjs` (or `npm start`) reads the environment; it does not load `.env` automatically. Run behind HTTPS termination. Configure proxy body limit 16 KiB, request timeout 45 seconds, and per-IP rate limits. Bind to a private interface; do not expose the plain HTTP port publicly. Avoid request-body logging: purchase tokens act as secrets.
4. Set the final `https://…/v1/google/verify` URL and the **public** PEM key in `examples/calendar-puzzle/src/purchases/config.ts`, rebuild the app. Neither the service-account key nor the signing private key belongs in the app.
5. Run `npm test`. Use Play license testers to complete the manual matrix in the app's `docs/IN-APP-PURCHASES.zh-CN.md` before release.

The SKU and Android package are fixed in `service.mjs` and must match the store configuration. Configure one permanent buy option, quantity one, no rental/preorder/multi-quantity offers. Requests accept `{ productId, purchaseToken, installationId }`; no client-provided `owned`/price/account state is trusted. Price is exclusively provided by BillingClient on the device.

The signed lease uses RSA-SHA256, contains product, package, installation, SHA-256 token hash, entitlement state and timestamps. TTL is seven days, never an auto-renewing payment. Reinstall requires a fresh store query/restore; it does not inherit an editable local boolean. Key rotation requires a coordinated app update because the client pins the public key. Retain old signing key until clients are upgraded or implement explicit key IDs and a rotation window before changing it.

## Failure and refund behavior

An unverified first purchase stays locked; Play cancellation or pending payment does not grant access or get acknowledged. Simultaneous duplicate verification calls coalesce, and already acknowledged purchases do not get acknowledged again. If another server instance wins acknowledgement, the service re-reads Google's authoritative state. A later refresh always queries Google again (no positive entitlement cache on the server).

Online refunded/cancelled purchases return signed `owned:false`; the app replaces any old positive lease. On cold start, foreground resume, network reconnection and explicit Restore/Reconnect, the app rechecks inventory and the server. Existing signed grants survive a transient outage only until expiry. Fully offline refunds cannot be observed immediately. There is no constant polling or background render loop. This version has **no RTDN/background refund push**; add authenticated Pub/Sub notifications and persistent token/account storage if near-real-time server-side entitlement management is needed later.

The app currently has no game-account login: rights are restored through the current platform store account and are not shared between iOS and Android. The purchase token is a bearer proof; public endpoints need rate limiting, secret redaction, monitoring and private-key protection. For a future account system, bind verified tokens to authenticated accounts before issuing leases.

References: [Play Billing security](https://developer.android.com/google/play/billing/security), [ProductPurchaseV2](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2), [acknowledge](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products/acknowledge).
