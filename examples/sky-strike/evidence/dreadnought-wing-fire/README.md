# Dreadnought wing guns and enemy muzzle flashes

Four hull-space muzzle tips calibrated against boss-dreadnought.png now alternate ownership of the existing spiral/fan rounds. Bullet count, damage, speed and cadence are unchanged. The front cannon only emits its laser: shared muzzle coordinates drive rendering, warning, sparks and collision, with the cannon aiming at the locked beam target and no recoil from ordinary wing fire.

Enemy projectile emission now creates compact 90 ms muzzle flashes, including generic enemies, elite/Boss patterns, special volleys and quantum paired fire. Volleys at one source/muzzle deduplicate; the total is bounded at 96, cleared on teardown, and uses immutable GPU masks without uploads per frame. Death debris/reflections retain their existing impact effects.

Validation: all 92 Sky Strike tests and full Games TypeScript check passed. Registered dread-wing and dread-laser scenarios verify four real spawn origins, unchanged normal bullet count, compact flashes, front laser origin, locked aim and damage on its rendered path. Fighter and quantum regression scenes passed. Wing and laser screenshots visually reviewed. The first laser assertion incorrectly expected reduced health after a lethal 100-damage hit; the fixture now verifies the lost life/rebirth. Native build and strict signature verification passed.

Full npm test retained unrelated MUGEN byte-exact/viewer failures and pending Petra/acceptance tests, bounded at 120 seconds. The web build initially exceeded its 60-second limit while concurrent repository tests ran; rerun recorded separately.

Web rebuild passed. Phone installation and launch succeeded; fresh native host snapshots confirm ready rendering. This is a startup check; gameplay visual/behavior coverage is the registered browser suite above.
