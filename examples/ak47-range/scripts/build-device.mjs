import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { verifyBundledAssets } from './sync-game-assets.mjs';

const app = fileURLToPath(new URL('..', import.meta.url));
const udid = process.env.IOS_DEVICE_UDID;
const signingFile = path.join(app, 'App_Resources/iOS/signing.local.xcconfig');
const team = process.env.IOS_TEAM_ID || (existsSync(signingFile)
  ? readFileSync(signingFile, 'utf8').match(/DEVELOPMENT_TEAM\s*=\s*([A-Z0-9]+)/)?.[1] : undefined);
if (!udid || !team) throw new Error('Set IOS_DEVICE_UDID and IOS_TEAM_ID (or signing.local.xcconfig DEVELOPMENT_TEAM).');
const env = { ...process.env,
  DEVELOPER_DIR: process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer',
  BUNDLE_GEMFILE: path.join(app, 'Gemfile'), COCOAPODS_DISABLE_STATS: 'true',
};
function run(command, args) {
  const result = spawnSync(command, args, { cwd: app, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run(process.execPath, ['scripts/ios.mjs', 'prepare', 'ios']);
const resolved = path.join(app, 'platforms/ios/ak47range.xcworkspace/xcshareddata/swiftpm/Package.resolved');
mkdirSync(path.dirname(resolved), { recursive: true });
copyFileSync(path.join(app, 'locks/Package.resolved'), resolved);
run('bundle', ['exec', 'xcrun', 'xcodebuild',
  '-workspace', 'platforms/ios/ak47range.xcworkspace', '-scheme', 'ak47range',
  '-configuration', 'Debug', '-sdk', 'iphoneos', '-destination', `id=${udid}`,
  '-allowProvisioningUpdates', '-allowProvisioningDeviceRegistration',
  '-disableAutomaticPackageResolution',
  `DEVELOPMENT_TEAM=${team}`, 'SWIFT_ENABLE_EXPLICIT_MODULES=NO',
  'IPHONEOS_DEPLOYMENT_TARGET=15.0',
  `BUILD_DIR=${app}/platforms/ios/build`, `SHARED_PRECOMPS_DIR=${app}/platforms/ios/build/sharedpch`,
  'build',
]);
verifyBundledAssets();
