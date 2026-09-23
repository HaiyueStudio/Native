# Settings, skins and hint allowances — 2026-09-23

Settings now use equal-width full-game / privacy-policy buttons, with a top-right close button. The duplicate history button is removed; the calendar remains the history entry. Required ad-privacy controls retain initialization/loading feedback.

Three per-instance palettes cover background, board, target cells, toolbar icons, calendar, dialogs and network indicators: 简约白 (default), 琉璃蓝 (light blue), 神秘紫 (dark purple). Preferences share the existing autosave. Old or unrecognized appearance preferences fall back to white without invalidating the puzzle. Piece colors remain distinct for play and matching hints.

Hint balances were already separate in `bridge/rewards/controller.ts`; the accounting did not need migration. Local calendar-day rollover resets free usage and daily ad limits but preserves earned credits. Free hints are spent first. The hint dialog now explicitly describes expiry versus carryover. Regression coverage skips several unused days, accumulates ads on multiple days, restarts the controller and checks spending order.

Palette and language texture changes are applied at the next update boundary. Browser stress testing also exposed an existing Mesh3DRenderer texture-replacement bug: the released texture's bind group survived until asynchronous loading finished. Engine now immediately binds the fallback; a regression covering base/emissive textures fails before the fix and passes after it. Native uses its explicit GPU texture upload path.

## Verification

- Games calendar-focused tests: 47 passed, including old-save fallback and text contrast.
- Native tests: 79 passed, including non-accumulating daily free hints and persistent ad credits.
- Games and Native TypeScript checks: passed. Games full build and final calendar target build passed.
- iOS bundle/prepare and x86_64 iOS Simulator build: passed. This is compilation, not a live device interaction test.
- Chrome WebGPU: all 9 skin cases passed with zero captured GPU validation errors and screenshots reviewed. All 4 network-button cases passed after layout changes.
- Engine renderer lifecycle: 22 passed; Engine workspace: 654 passed; workspace typecheck/build passed. Engine repository typecheck and all 1,305 repository tests passed. Root build passed with `EXAMPLE_FILTER=css-material,cube-texture` (all library builds plus shared Engine, source viewer and two relevant examples). The initial unfiltered examples build was stopped after library builds to bound unrelated work.
- Games full tests: 1,239 passed, 13 failed, 20 skipped. Failures match the preceding task's unchanged Parabox/Boxbound (10), Mugen (2), and manifest save-facade (1) failures.
- Engine module boundaries, responsibilities and renderer prepare checks passed. API check reports the existing @haiyue/ui capability-entrypoint/export mismatch; no API/export changes in this task.

## Reproduction and scope

Browser fixture: `Games/games/test/fixtures/calendar-skins/main.ts`; runner: `node scripts/verify-calendar-network.mjs --skins` from Games. It uses actual CalendarPuzzleGame GUI, pointer events and Chrome WebGPU, checks no GPU validation errors, cycles through all skins, checks same-row actions and close navigation, and destroys/recreates the game to verify autosave restoration. Mock purchases and rewards avoid real transactions/ads. Each JSON records source revision, dirty state, bundle hash, renderer hash and capture metadata. Screenshots are under `Games/.artifacts/calendar-skins/`.

No real device installation or live purchases/ad requests were performed for this change.

The browser run used a locally packed Engine containing the fix (Games installed package refreshed from that archive; no dependency manifest or lockfile changes). Native retains its existing pinned vendor package and uses the separate, synchronous external-GPUTexture path.

Local Engine tarball SHA-256: `11f9767455188edc8f797ccb204d834d05a15dd38236061099707a90dfdf8793`.
