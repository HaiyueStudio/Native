# Android splash fullscreen — 2026-09-23

The Android Page applied window inset padding outside the branding layer. Changed the shared launch Page/container to forward insets, with safe-area padding applied only to gameRoot. The sibling splash now fills the window. System startup/window/bar backgrounds use the same brand color.

Validation:
- Native TypeScript check passed.
- Shared branding/loading tests: 3 passed, including safe-area ownership and first-presentation/failure behavior.
- Android build succeeded and installed with adb install -r; existing player save retained.
- Cold-launch captures after-3.png (branding), after-4.png (fade), after-5.png (game) visually verified without top/bottom white bands. Existing light-blue staircase puzzle retained.
- USB connection was intermittent; captured files were pulled after reconnection. No Engine or Games source changes and no repository-wide Engine checks.
