# Achievements core (0.2 development)

Independent of Engine, NativeScript, GPU, and platform SDKs. The public development entry is `@haiyue/native/achievements`. Steam/Game Center adapters are P1 and are **not implemented** by this core.

```ts
import { createAchievements, createLocalAchievementProvider, createAchievementStorage } from '@haiyue/native/achievements';

const achievements = createAchievements({
  catalog: { schemaVersion: 1, gameId: 'my-game', environment: 'production', version: '1', definitions: [
    { id: 'first-win', target: 1, titleKey: 'achievement.win', descriptionKey: 'achievement.win.description' },
  ] },
  provider: createLocalAchievementProvider('my-game'),
  guestProfile: 'player-1',
  storage: createAchievementStorage(localStorage), // or a native atomic string store
});
await achievements.initialize();
const unsubscribe = achievements.subscribe(event => console.log(event.type));
await achievements.unlock('first-win');
await achievements.flush();
unsubscribe();
achievements.dispose();
```

The application owns game rules; `reportProgress(id, absoluteValue)` is monotonic, integer, bounded by target, and idempotent. No delta increment, auto-login, reward grant, UI creation, or automatic sharing. `load()` returns a detached snapshot. Hidden definitions queue locally until complete to avoid revealing a platform secret by reporting partial progress.

Await initialization. A storage error never returns an accepted receipt. Use one controller/writer per profile namespace. Storage `write` must atomically replace a snapshot; desktop uses synced temporary files and rename, browsers may supply atomic Web Storage. A catalog or target change requires an explicit `migrate` callback, whose output is validated before saving; an invalid/corrupt snapshot fails closed. It is not automatically reset.

`queued` means durable local intent; `provider-accepted` means SDK acceptance; `reconciled` means a subsequent platform read agrees, **not guaranteed cloud durability**. `local-only` never claims a Steam/Game Center unlock. The outbox coalesces to one highest value per catalog ID (maximum 1000 definitions). `flush` first reads provider state, preserving higher platform progress, then batches due absolute values. For querying providers, accepted intents remain durable until read-back agrees; a still-missing value may be retried after five seconds, including after restart. Call at meaningful checkpoints/connectivity changes, not every frame. Failures use persisted exponential backoff capped at five minutes; permanent errors require fixing configuration/migration, not endless retries.

Storage is partitioned by game, environment, provider, provider application ID and player/guest identity. Guest history is not automatically imported on login. Account changes abort in-flight platform work; captured generation prevents late completion from updating another account. A provider must check `context.session.playerId` against its actual SDK identity immediately before every side effect, respect cancellation and notify session changes. Dispose silences callbacks and cancels bounded network/platform work. A stuck SDK operation times out; storage itself must supply reliable bounded IO.

Progress aggregation across devices is max, not sum. Cross-device cumulative counters need a separate authoritative design. Do not use local achievements as purchase entitlements or anti-cheat evidence. `showUI()` returns `unsupported` for local mode; GPU GUI/i18n belongs to the optional future Engine extension.

Validation: `node --test test/achievements-core.test.mjs` from Native root; consumer verification is in `scripts/validation/achievements-core.mjs`. No real platform acceptance is inferred from these tests.
