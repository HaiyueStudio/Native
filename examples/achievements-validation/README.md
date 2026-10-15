# P1 achievement acceptance

The public Rubik uses the same `games/rubiks-cube/achievements.ts` rule definitions and GPU GUI on Web, desktop and NativeScript. `shared/rubik.ts` composes the Native facade with the extension. First solve, ten solves, timed 3×3 and hidden mirror are counted only after a full shuffle followed by manual moves. Automatic restore, undo and stopped shuffles are excluded. Cold starts keep achievement progress; they do not restore an unfinished cube.

## Local development

- Desktop: `cd desktop && npm ci && npm run setup && npm run build:audio && npm run bundle && npm start`.
- Web: from `desktop`, `node scripts/bundle-web.mjs`; serve `build/web` over localhost. Add `?verify=1` for an isolated game verification profile.
- iOS: from `examples/rubiks-cube`, `npm ci && npm run bundle:ios`; use your own signing configuration for `build:device`.
- Android: same directory, `npm run bundle:android` / `npm run build:android`; JDK/SDK configuration follows the other Native Android examples.
- Uniform source/development checks: `npm run release:verify -- --profile development [--desktop] [--platform ios|android]` from Native.

All new packages/archives are development inputs, not a newly published npm version. Runtime SDKs remain optional. Web/Android use local mode; Steam and Game Center must be explicitly configured. The extension archive is named `haiyue-extensions-0.2.1-p1.tgz` and identified by SHA-256; its development changes must not be mistaken for the published 0.2.1 registry package.

## Platform setup and evidence

No Steam App ID/SDK or Game Center application is currently configured. Follow the respective provider guides before enabling them. The sample catalog in `shared/rubik.ts` declares the intended IDs (`RUBIK_FIRST`, `RUBIK_TEN` + `RUBIK_SOLVES`, `RUBIK_FAST`, `RUBIK_MIRROR` on Steam, `rubik.*` on Game Center); these names have not been created in a platform console by this change.

For each actual app/build/platform record: app/bundle and SDK/runtime version, source/archive/binary hashes, OS/device/backend, account alias (redact real IDs), expected/actual local and platform progress, SDK callback and subsequent readback, and UI screenshot. Test login/cancel, partial/complete/hidden, duplicates, offline/restart, account changes, background/window transitions and disposal. Never reset a real player's production achievements. SDK mocks and compile checks do not close these gates.
