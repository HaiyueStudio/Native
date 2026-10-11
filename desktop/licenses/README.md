# Desktop dependency notices (development)

Haiyue host/sample code is MIT. This directory preserves direct native dependency licenses for development packaging: Deno 2.9.6 (MIT), GLFW 3.4 (zlib), miniaudio 0.11.22 (dual public-domain/MIT; retain the upstream text), Skia (BSD). `@napi-rs/canvas` 1.0.7 includes its MIT text at packaging time. Noto Sans CJK Sans2.004 is OFL; setup verifies and packaging includes the original font license.

Sources and fixed hashes are in `../toolchains.json` and `../package-lock.json`. Skia's BSD notice was retrieved from its upstream LICENSE; this does not identify the complete Skia feature/dependency build manifest used by the prebuilt N-API binary. Deno includes V8/Rust dependencies, and Skia has transitive dependencies. The complete binary notices/SBOM for those upstream prebuilts must be collected and reviewed in G07 before public binary distribution. Current artifacts are development acceptance builds, not approved public redistributables.

The packaged Engine is MIT; wgpu-matrix is MIT. Their code is bundled into main.js. Desktop uses no third-party character/gun models. Existing mobile notices in the repository remain applicable to mobile builds separately.
