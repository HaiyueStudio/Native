const { readFileSync } = require('node:fs');
const path = require('node:path');
/** Validate only the platform being released; iOS does not require an Android launch. */
module.exports = function (hookArgs) {
  if (!hookArgs?.checkForChangesOpts?.release && !hookArgs?.prepareData?.release && !process.argv.includes('--release')) return;
  const root = path.resolve(__dirname, '..');
  const platform = String(hookArgs?.prepareData?.platform ?? hookArgs?.platformData?.platformNameLowerCase
    ?? hookArgs?.checkForChangesOpts?.platform ?? process.argv.find(arg => ['ios', 'android'].includes(arg)) ?? '').toLowerCase();
  if (!['ios', 'android'].includes(platform)) throw new Error('Release blocked: cannot determine AdMob target platform.');
  const config = readFileSync(path.join(root, 'src/rewards-config.ts'), 'utf8');
  const unit = config.match(new RegExp(`\\b${platform}Unit\\s*:\\s*['"]([^'"]+)['"]`))?.[1];
  const nativeFile = platform === 'ios' ? 'App_Resources/iOS/Info.plist' : 'App_Resources/Android/src/main/AndroidManifest.xml';
  const native = readFileSync(path.join(root, nativeFile), 'utf8');
  const app = platform === 'ios'
    ? native.match(/<key>GADApplicationIdentifier<\/key>\s*<string>([^<]+)<\/string>/)?.[1]
    : native.match(/<meta-data\b[^>]*android:name="com\.google\.android\.gms\.ads\.APPLICATION_ID"[^>]*android:value="([^"]+)"/)?.[1];
  if (!/^ca-app-pub-\d{16}\/\d{10}$/.test(unit ?? '') || !/^ca-app-pub-\d{16}~\d{10}$/.test(app ?? '')
    || unit.includes('3940256099942544') || app.includes('3940256099942544')) {
    throw new Error(`Release blocked: configure valid production ${platform} AdMob app and rewarded unit IDs. See docs/REWARDED-HINTS.zh-CN.md.`);
  }
  if (app.split('~')[0] !== unit.split('/')[0]) throw new Error(`Release blocked: ${platform} AdMob app and unit must belong to the same publisher.`);
};
