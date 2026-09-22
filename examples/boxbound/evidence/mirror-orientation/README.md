# Flip mirror orientation regression

The miniature already reflected its contents, but the active scene returned to canonical orientation after entry. Current occurrence parity now survives physical crossings (including implicit self exits), undo and reload. Independent-level reset/return restores the recorded outside orientation. Keyboard and native stick input convert screen directions at execution time.

The existing Engine transform hierarchy mirrors scene meshes without duplicating the scene. Triangle winding, retained asymmetric portal geometry, camera targets, labels and exterior occlusion share the same orientation.

Validation: 118 targeted rule regressions, 26 transfer/Flip/chapter tests, 15 native unit tests, three browser fixtures with screenshots, and 36 Android device checks. The app was installed with data preserved and restored to normal mode. Engine sources were not changed.
