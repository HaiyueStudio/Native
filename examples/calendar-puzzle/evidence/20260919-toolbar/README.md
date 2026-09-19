# Title-row toolbar (2026-09-19)

- Rotation icon arrow points counterclockwise, matching the actual piece rotation. The arrowhead is tangent to and connected with the circular stroke.
- Rotate, flip, shuffle and hint sit at y=24, centered on the 56-unit title row and aligned to the right edge of the left puzzle tray.
- Title gets a separate bounded text region with a 20-unit gap to the buttons; existing text fitting supports Chinese, English and Japanese.
- Web typecheck, target build and signed iPhone build passed.

- iPhone smoke: 21/21 passed, including moved-button interaction; Chinese/English/Japanese screenshots visually reviewed. Normal app relaunched with the existing user save.
- Full Games suite: 658 tests, 636 passed, 20 skipped and the same 2 unrelated existing failures (HYMUGEN canonical packing, viewer-product assertion).
