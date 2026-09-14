import { syncGameAssets } from './sync-game-assets.mjs';
import { syncOrientation } from './sync-orientation.mjs';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { patchCanvas } from './patch-canvas.mjs';

const app = fileURLToPath(new URL('..', import.meta.url));
const developer = process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer';
if (!existsSync(developer)) throw new Error(`Xcode developer directory not found: ${developer}`);
const profile = path.join(app, '.ns-profile');
mkdirSync(profile, { recursive: true });
const cli = path.join(app, 'node_modules/nativescript/bin/tns');
const args = process.argv.slice(2);
if (['prepare', 'build', 'run'].includes(args[0])) { syncOrientation(); syncGameAssets(); }
if (['prepare', 'build', 'run'].includes(args[0])) console.log('Canvas binding patch:', patchCanvas());
const signingFile = path.join(app, 'App_Resources/iOS/signing.local.xcconfig');
if (['build', 'run'].includes(args[0]) && !args.includes('--teamId') && !args.includes('--provision')) {
  const team = process.env.IOS_TEAM_ID || (existsSync(signingFile)
    ? readFileSync(signingFile, 'utf8').match(/DEVELOPMENT_TEAM\s*=\s*([A-Z0-9]+)/)?.[1] : undefined);
  if (!team) throw new Error('Set IOS_TEAM_ID or create App_Resources/iOS/signing.local.xcconfig with DEVELOPMENT_TEAM.');
  args.push('--teamId', team);
}
// Running through Bundler pins the Ruby dependencies for CLI-spawned pod calls.
const result = spawnSync('bundle', ['exec', process.execPath, cli, ...args, '--profileDir', profile, '--disableAnalytics'], {
  cwd: app,
  stdio: 'inherit',
  env: { ...process.env, DEVELOPER_DIR: developer, BUNDLE_GEMFILE: path.join(app, 'Gemfile'), COCOAPODS_DISABLE_STATS: 'true', npm_config_registry: 'https://registry.npmjs.org' },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
