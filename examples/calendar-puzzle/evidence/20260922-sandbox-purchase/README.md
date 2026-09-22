# Sandbox purchase verification — 2026-09-22

The user completed the StoreKit sandbox purchase. Device lifecycle snapshots in iphone-purchase.jsonl confirm entitled=true, price=US$1.99 and unlimited hints. A subsequent process restart shows verified ownership again in iphone-restart.jsonl, and iphone-after-restart.png shows the unlimited hint indicator.

Cancellation was not performed on device; it remains pending. Controller unit tests cover cancellation but do not replace the real-device check.

The user found that the Settings upgrade caption remained visible after purchase. This has been changed to Restore purchases, with actual restore triggered on tap for owners. The owned panel hides the Buy button, localized price and free-tier caption. On entitlement revocation the upgrade presentation returns. An explicit debug-only restore smoke flag validates the already-owned path without initiating checkout; production builds ignore launch flags.

Validation so far: Games and Native typechecks passed; 54 Native tests passed; 46 Calendar Puzzle tests passed; filtered Calendar Puzzle web build and signed iOS Debug build passed. Full Games suite is recorded separately and must not be represented as passing until complete.


## Final device result

The updated build was installed. Owned Settings displays Restore purchases, the owned panel hides Buy and price, another date can be selected, and unlimited hints remain enabled after restart. Six of seven automated owned-path checks passed; the explicit restore assertion reached its 120-second deadline while waiting for Sandbox authentication. After the user authenticated and backgrounded the app, iphone-after-auth.jsonl shows entitled=true, phase=ready and busy=false. The intermediate restored phase was not captured. This confirms healthy verified ownership after authentication, not an uninterrupted automatic restore-test pass.

Full Games suite finished with 1013 passed, 4 failed, 6 cancelled, 20 skipped. Unrelated Boxbound/Mugen long-running child tests were stopped after over four minutes; remaining failures concern other games. Relevant Calendar Puzzle and Native checks passed.

Normal production-save launch was restored at 14:19:59 after the device connection recovered.

## Cancellation verified on a fresh Sandbox account

The user switched to a new Sandbox Apple Account and cancelled the system purchase sheet. The 15:50:18 lifecycle snapshot in iphone-cancel-new-account.jsonl confirms phase=cancelled, entitled=false, unlimited=false, busy=false, canPurchase=true and price=US$1.99. Cancellation now has real-device evidence, superseding the earlier pending status.
