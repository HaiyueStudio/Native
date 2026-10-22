module.exports = function ($staticConfig, hookArgs) { return import('@nativescript/core/cli-hooks/before-checkForChanges.mjs').then(m => m.default($staticConfig, hookArgs)); };
