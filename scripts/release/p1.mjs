import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { runLogged, runStages } from './runner.mjs';

/** Development verification never rewrites the published 0.1.4 frozen candidate. */
export async function verifyP1({ desktop = false, platform } = {}) {
  if (platform && !['ios', 'android'].includes(platform)) throw Error('Expected ios or android');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const output = resolve(root, 'artifacts/release', `p1-${new Date().toISOString().replace(/[:.]/g, '-')}`); mkdirSync(output, { recursive: true });
  const report = { schemaVersion: 1, targetVersion: '0.2.0', profile: 'development', startedAt: new Date().toISOString(), status: 'failed', stages: [], skipped: [],
    qualification: 'Development checks only; platform acceptance and release candidate remain pending.',
    dependencies: Object.fromEntries(['desktop/package-lock.json', 'examples/rubiks-cube/package-lock.json', 'desktop/vendor/haiyue-engine-0.2.1.tgz', 'desktop/vendor/haiyue-extensions-0.2.1-p1.tgz'].map(file => [file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')])),
    pendingAcceptance: ['Steamworks SDK compilation/freeze and Windows/macOS real client', 'Game Center configured iOS/macOS signed applications and real accounts', 'Windows x64 / Apple Silicon hardware', 'Same-quality Web/native-TS/Rust three-round target-device performance', 'Current iPhone/Android binary interaction and old-system-feature regression', 'ATT restricted physical device (existing record)'],
  };
  const stages = [], run = (name, args, cwd = root) => stages.push({ name, run: () => runLogged(process.execPath, args, { cwd, env: process.env, log: resolve(output, `${name}.log`) }) });
  const npm = process.env.npm_execpath; if (!npm) throw Error('Use npm run release:verify -- --profile development');
  run('native-tests', [npm, 'test']);
  run('engine-free-consumer', ['scripts/validation/achievements-core.mjs']);
  run('packed-extension-consumer', ['scripts/validation/achievements-extension.mjs']);
  run('npm-typecheck', ['npm/typecheck-package.mjs', 'artifacts/native-development-package']);
  run('rubik-typecheck', [npm, 'run', 'typecheck'], resolve(root, 'examples/rubiks-cube'));
  run('rubik-tests', [npm, 'test'], resolve(root, 'examples/rubiks-cube'));
  run('desktop-typecheck', ['scripts/check.mjs'], resolve(root, 'desktop'));
  run('desktop-bundle', ['scripts/bundle.mjs'], resolve(root, 'desktop'));
  run('web-bundle', ['scripts/bundle-web.mjs'], resolve(root, 'desktop'));
  if (process.platform === 'darwin') run('gamekit-macos-compile', ['desktop/platform-libs/game-center/build.mjs']);
  else report.skipped.push('GameKit compilation requires Xcode on macOS');
  if (desktop) run('desktop-gpu-probes', ['scripts/verify.mjs'], resolve(root, 'desktop'));
  else report.skipped.push('Add --desktop to run native GPU/window/audio probes');
  if (platform) run(`rubik-${platform}-bundle`, [npm, 'run', `bundle:${platform}`], resolve(root, 'examples/rubiks-cube'));
  else report.skipped.push('Add --platform ios|android for the corresponding mobile bundle');
  try { if (!await runStages(stages, report, s => console.log(`[${s.status}] ${s.name}`))) process.exitCode = 1; }
  finally {
    report.finishedAt = new Date().toISOString();
    writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(`P1 development report: ${resolve(output, 'report.json')}`);
  }
}
