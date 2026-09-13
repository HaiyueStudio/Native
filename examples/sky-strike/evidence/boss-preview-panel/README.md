# Boss previews and mission panel

Audited all 12 bosses. Missions 1–5 now include the same cannon/rotor/impeller/blade/hangar/iris draw commands as combat. Mission 6 includes all nine articulated body sections. Both mission 7 twins include their matching gyro. Mission 8 includes four mining arms and central cog. Missions 9/10 use procedural portraits with no separate hull pieces; mission 12 already has a composite six-gun portrait. Mission 11 keeps two shared-pivot gun GUI layers added in the preceding change.

Composites render once through the existing indexed sprite GPU renderer into a transparent texture (maximum side 384 px), reuse cached results, preserve aspect, and are destroyed with the battle layer. No added asset downloads or Canvas 2D. The panel uses faint noninteractive circuit geometry and a bounded 8.5-second sweep, paused when hidden or covered by options. The heading is centered on the panel, with reserved settings-button space through narrow-screen font sizing.

Checks: scoped strict TypeScript passed; 90 Sky Strike tests passed; all 12 mission browser scenarios plus narrow Japanese, wide English and three inferno locales passed with 4x MSAA. Each verifies heading alignment, sweep movement/containment, and stable texture memory after repeated sync. Mission 11 also checks attachment pivots and repeated next/back visibility/reuse. Screenshots for missions 1, 6, 8, 12 visually reviewed. Final font-size adjustment additionally rechecked with narrow/wide/Inferno cases.

Repository-wide checks have unrelated Neon Circuit type errors and MUGEN/Petra test failures/time limit, recorded in the preceding inferno-preview-guns evidence. No unrelated sources changed for this work.

Native: device build and strict codesign verification passed. Installed org.haiyue.native.skystrike and launched successfully. Fresh phone host log confirms ready/present through frames 1, 120 and 240, followed by normal suspend at frame 291; zero per-frame texture uploads. Device evidence covers startup/menu, not a new full gameplay acceptance run.

The final wide-screen recheck first hit the existing fixed-delay pointer helper race. The fixture now waits for two actual render frames for each down/up event, with a 5-second bound. Narrow Japanese, wide English and Inferno Chinese all passed the rerun. Original failed log retained.
