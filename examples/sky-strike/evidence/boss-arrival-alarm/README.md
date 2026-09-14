# Boss arrival alarm and serpent bomb balance

- Added a one-second original low/high scanner sound, looped only in the existing three-second pre-arrival warning window. Stops on boss arrival, pause, mute, game over, background or disposal. Uses one centered priority-50 voice separate from music and lasers.
- Serpent body segments take 20% of raw bomb damage: 420 × 0.2 = 84. Full-health segments retain 36 of 120 HP after one bomb; a second bomb can destroy those damaged segments. Head retains 30% damage, out-of-range segments remain undamaged, body HP stays independent.
- Games typecheck and 95 focused tests passed. Native typecheck and 9 example tests passed.
- Registered browser cases boss-warning-audio, audio and balance all passed, covering actual spawn timing, mixed audio, pause/mute, one/two bomb damage and isolated body health.
- The fixture now uses its existing frame-aware click helper for Start as well as carousel navigation. The previous same-frame down/up dispatch caused GUI-start false negatives; no production input behavior or assertions were weakened.
- Full repository tests retain unrelated MUGEN serialization/viewer failures and unresolved workers when bounded at 120 seconds; the log is retained.

- Final Web and Native builds passed; package hash verifies the 20% body multiplier and alarm PCM. Updated app installed and launched on iPhone; startup logs retained.
