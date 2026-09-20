const { readFileSync } = require('node:fs');
const path = require('node:path');
/** Prevent accidental store releases with Google's demo app IDs or units. */
module.exports = function (hookArgs) {
  if (!hookArgs?.checkForChangesOpts?.release && !hookArgs?.prepareData?.release && !process.argv.includes('--release')) return;
  const root = path.resolve(__dirname, '..');
  for (const file of ['src/rewards-config.ts', 'App_Resources/iOS/Info.plist', 'App_Resources/Android/src/main/AndroidManifest.xml']) {
    const text = readFileSync(path.join(root, file), 'utf8');
    if (text.includes('3940256099942544')) throw new Error(`Release blocked: replace official AdMob demo IDs in ${file}. See docs/REWARDED-HINTS.zh-CN.md.`);
  }
};
