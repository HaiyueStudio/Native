# Generated sci-fi GUI skins — 2026-09-10

Changes cover the level carousel and pause dialog. Three generated assets are
bundled: an alpha launch/resume skin, an alpha arrow housing (mirrored UVs for the
right arrow), and an opaque purple-glass pause panel. Source art and the exact
built-in image_gen prompts are in Games/games/sky-strike/assets/gui-art.md.

GuiButton retains ownership of input and live text; its decorative GuiImage child
is excluded from hit testing. Constructor-supplied pointer callbacks update tint
for press/hover/leave feedback. Arrow hit targets remain 48–64 logical points.
Child layouts follow their parent button when the viewport changes. Pause title,
copy and Resume are centered proportionally inside the generated panel.

Validation passed: Games/native typechecks; 18 Sky Strike rules/viewport tests;
6 native tests; real WebGPU browser fixtures at wide, standard and narrow sizes,
including next/previous buttons, launch, pointer input/cancel and pause/resume.
Menu and pause screenshots were visually inspected. No golden baseline updated.
Full Games tests retain the existing result: 420 pass, 10 unrelated MUGEN/UI
failures, 20 skip. The full Games build passed; see the accompanying build log.

The native package built, passed strict codesign verification, installed and
launched. After bringing the backgrounded app to the foreground, it recorded
1,320 presented frames without error. The fresh device-menu.png was visually
checked: both mirrored arrows, the generated launch skin and updated sector
labels are visible. Pause layout and Resume behavior are browser-verified; a
manual user response about the native pause screen remains optional/pending.

One visible canvas, Engine GUI rendering, static texture uploads, 4x MSAA,
portrait-only policy and proportional narrow-screen camera tracking are unchanged.
No packages were published and no commits made.
