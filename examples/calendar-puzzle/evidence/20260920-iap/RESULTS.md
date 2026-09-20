# 2026-09-20 IAP validation

- Native typecheck: passed; Games typecheck: passed.
- Native tests: 32 passed. Service tests: 5 passed.
- Android compileSdk/targetSdk 36 debug APK: built, updated with adb install -r, started on X4000 Android 14. Original saved puzzle/history retained.
- Android actual UI: Hint opens paywall; unavailable store leaves price absent and Buy disabled. Back returns to original puzzle. Calendar history/star browsing remains free. Attached screenshots show these states. Device subsequently locked; no claim that every checkout/date-selection scenario was exercised on hardware.
- iOS arm64 generic device Debug build, CODE_SIGNING_ALLOWED=NO: BUILD SUCCEEDED, includes HYCalendarStore.swift and Objective-C metadata. Final NativeScript iOS bundle prepared and rebuilt successfully. Later signed device build installed on connected iPhone 15 Plus. All 11 isolated-save purchase UI checks passed using real StoreKit queries (see iphone-purchase-smoke.jsonl and iphone-iap-*.png). Product unavailable, no checkout initiated. Normal launch restored after diagnostics; no real StoreKit checkout.
- Games full build + calendar target build: passed.
- Games full tests: 672 total, 650 passed, 20 skipped, 2 existing MUGEN failures (HYMUGEN canonical byte-exact; viewer manifest-backed controls). Calendar/payment changes do not modify these modules.
- Sandbox/Play license-test purchase, cancellation UI, pending approval, reinstall/restore and remote refund end-to-end: NOT RUN. Products/test accounts and deployed Google verification URL/public key are not configured.
- Unit tests cover cancellation, pending, duplicate checkout/callbacks, ownership reconciliation, signed cache expiry/token mismatch/clock rollback, offline first-purchase rejection, refund/recovery, date/action gates, exact localized price rasterization and Debug/Release bypass guard. Server tests verify signatures/tampering, Google API paths, acknowledgement ordering/failure/duplicates and rejection of wrong/consumed/rental products.
