# Steam C ABI v1

From `Native`, supply an authorized SDK and its exact version:

```sh
STEAMWORKS_SDK=/absolute/path/to/sdk STEAMWORKS_SDK_VERSION=YOUR_EXACT_VERSION node desktop/platform-libs/steam/build.mjs
```

Windows uses the x64 Visual Studio developer shell (`cl`); macOS uses Xcode C++. `public/steam` headers and the matching platform redistributable/import library are required. The build writes `desktop/build/steam/sdk-lock.json` with header/runtime/output hashes. Review it and record the version before acceptance; no SDK version has been verified here. Only permitted redistributable files belong beside the built shim; the development SDK is excluded from Git/npm and from the default local game package.

Run the development desktop sample with `--provider=steam --steam-app-id=YOUR_APP_ID --platform-library=/absolute/path/to/the/shim`. For local development use Steam's documented `steam_appid.txt` workflow and launch the Steam client first. Shipping launch must be tested through the game's Steam installation; never ship the development App ID file unintentionally. The project does not automatically launch Steam or reset achievements.

ABI: `hy_steam_init`, `pump`, `player` (u64), `online`, guarded `achievement`/`stat` reads, guarded `set`, asynchronous `store`/`completion`, and `shutdown`. Calls are serialized on the host main thread. Exactly one owner and one StoreStats operation may exist. Other plugins must use this owner instead of independently calling StoreStats. Callback pump is stopped before callback objects, SDK and library are destroyed.

Required real acceptance: published backend IDs/int32 stats; app/user login; partial and complete progress; repeated/out-of-order writes; hidden items; restart/offline recovery; account A→B; callback failures; Steam launch; overlay checked independently. Windows x64 and macOS arm64 need separate evidence. Spacewar is connectivity-only and cannot prove this game's configured achievements.
