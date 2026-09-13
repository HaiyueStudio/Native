# Independent serpent segments

Removed water-filled shared damage and segment-to-head damage relay. Each body part keeps its own 120 HP; head damage affects only the head. Weapon overkill is clipped to the hit part and never spills to surviving nodes. Bombs apply the existing 70% resistance independently to each in-range head/body; out-of-range nodes remain untouched. A sufficiently strong area attack can still destroy multiple parts inside its real area.

Destroying a node preserves the other node instances, HP and weapons, removes only its owned hostile lasers and awards its score once. Logical segment order compacts immediately, so links connect to the preceding survivor. A separate fractional follow order closes each missing slot over 220 ms, with bounded frame-independent movement and pause support. Losing the last body part still immediately unlocks rapid head charges. Killing the head still ends the Boss encounter.

92 Sky Strike tests and full Games/fixture typechecks passed. Registered serpent-segments uses actual projectile collisions to test isolated damage, middle-node overkill, surviving neighbor HP, score, owned laser cleanup, smooth rejoin, pause, and first/middle/last destruction. Serpent-rage and balance verify final-body charge and independent in-range bomb damage. Updated shared-damage tests to the user's new independent-health behavior. Screenshot visually reviewed.

Native build, signature verification, install and launch succeeded; startup host snapshots confirm ready rendering. Targeted web build passed when run after the native build, using the supported 300-second timeout. The initial concurrent web build exceeded 120 seconds. No additional assets were needed.
