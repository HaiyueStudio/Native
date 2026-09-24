import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { compareFiles, selectedFiles, dependencies, verifyInstalled, verifyRelativeImports, verifyModelInputs, verifyRubyLocks, normalizePodfile, verifyPodsLock } from '../scripts/release/common.mjs';
import { runStages, runLogged } from '../scripts/release/runner.mjs';

function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'native-release-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const native = path.join(dir, 'standalone-checkout');
  const write = (file, content) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content)); };
  for (const repo of [native]) { mkdirSync(repo); execFileSync('git', ['init', '-q', repo]); }
  const config = { apps: { demo: ['ios'] }, appVersion: '0.1.0', gameInputs: ['games/demo'] };
  write(path.join(native, '.gitignore'), 'examples/demo/node_modules/\nexamples/demo/platforms/\nbridge/purchases/\n');
  write(path.join(native, 'bridge/host.ts'), 'host');
  write(path.join(native, 'games/demo/main.ts'), 'game');
  write(path.join(native, 'examples/demo/vendor/engine.tgz'), 'tarball');
  const pkg = { version: '0.1.0', license: 'MIT', dependencies: { engine: 'file:vendor/engine.tgz', tool: '1.2.3' } };
  const lock = { version: '0.1.0', lockfileVersion: 3, packages: {
    '': pkg,
    'node_modules/engine': { version: '0.1.0', resolved: pkg.dependencies.engine, integrity: `sha512-${createHash('sha512').update('tarball').digest('base64')}` },
    'node_modules/tool': { version: '1.2.3', resolved: 'https://registry.npmjs.org/tool/-/tool-1.2.3.tgz', integrity: 'sha512-fixture', license: 'MIT' },
  } };
  const pkgFile = path.join(native, 'examples/demo/package.json'), lockFile = path.join(native, 'examples/demo/package-lock.json');
  write(pkgFile, pkg); write(lockFile, lock);
  return { dir, native, config, write, pkg, lock, pkgFile, lockFile };
}

test('freeze includes shared source and tarballs, excludes generated/private/historical files', t => {
  const f = fixture(t);
  for (const file of ['examples/demo/node_modules/a.js', 'examples/demo/platforms/build', 'bridge/purchases/private.ts', 'examples/demo/evidence/old.json', 'examples/private/main.ts', 'release/candidate.json']) f.write(path.join(f.native, file), 'excluded');
  const files = selectedFiles(f.config, f.native);
  assert.ok(files['Native/bridge/host.ts']);
  assert.ok(files['Native/games/demo/main.ts']);
  assert.ok(files['Native/examples/demo/vendor/engine.tgz']);
  assert.equal(Object.keys(files).length, 6);
});

test('same version source/tarball changes and new untracked inputs invalidate candidate', t => {
  const f = fixture(t), before = selectedFiles(f.config, f.native);
  f.write(path.join(f.native, 'examples/demo/vendor/engine.tgz'), 'changed package with same version');
  f.write(path.join(f.native, 'games/demo/main.ts'), 'changed shared game');
  f.write(path.join(f.native, 'bridge/new.ts'), 'new module');
  assert.throws(() => compareFiles(before, selectedFiles(f.config, f.native)), /Changed:.*engine\.tgz/s);
  assert.throws(() => compareFiles(before, selectedFiles(f.config, f.native)), /Added: Native\/bridge\/new.ts/);
  rmSync(path.join(f.native, 'games/demo/main.ts'));
  assert.throws(() => selectedFiles(f.config, f.native), /Missing bundled game input/);
  assert.throws(() => compareFiles({ a: 'old' }, {}), /Missing: a/);
});

test('full dependency inventory verifies tarball bytes and rejects floating or stale locks', t => {
  const f = fixture(t);
  assert.equal(dependencies(f.config, f.native).demo.direct.tool.version, '1.2.3');
  f.pkg.dependencies.tool = '^1.2.3'; f.lock.packages[''].dependencies.tool = '^1.2.3';
  f.write(f.pkgFile, f.pkg); f.write(f.lockFile, f.lock);
  assert.throws(() => dependencies(f.config, f.native), /must be exact/);
  f.pkg.dependencies.tool = '1.2.3'; f.write(f.pkgFile, f.pkg);
  assert.throws(() => dependencies(f.config, f.native), /stale/);
  f.lock.packages[''].dependencies.tool = '1.2.3'; f.write(f.lockFile, f.lock);
  f.write(path.join(f.native, 'examples/demo/vendor/engine.tgz'), 'corrupted');
  assert.throws(() => dependencies(f.config, f.native), /integrity differs/);
});

test('transitive integrity and installed dependency versions are enforced', t => {
  const f = fixture(t);
  delete f.lock.packages['node_modules/tool'].integrity; f.write(f.lockFile, f.lock);
  assert.throws(() => dependencies(f.config, f.native), /incomplete locked dependency/);
  f.write(path.join(f.native, 'examples/demo/node_modules/engine/package.json'), { version: '0.2.0' });
  assert.throws(() => verifyInstalled('demo', f.native), /installed dependency differs/);
});

test('release gate stops after failure and records it without running subsequent stages', async () => {
  const report = { stages: [] };
  let ran = false;
  const ok = await runStages([
    { name: 'pass', run: () => {} },
    { name: 'fail', run: () => { throw new Error('build failed'); } },
    { name: 'must not run', run: () => { ran = true; } },
  ], report);
  assert.equal(ok, false); assert.equal(ran, false); assert.equal(report.status, 'failed');
  assert.equal(report.stages[1].error, 'build failed');
});

test('command failures and signals propagate while stdout/stderr remain reviewable', t => {
  const f = fixture(t), log = path.join(f.dir, 'command.log');
  assert.throws(() => runLogged(process.execPath, ['-e', 'console.error("diagnostic");process.exit(7)'], { log }), /exited 7/);
  assert.match(readFileSync(log, 'utf8'), /diagnostic/);
  assert.throws(() => runLogged(process.execPath, ['-e', 'process.kill(process.pid,"SIGTERM")'], { log }), /SIGTERM/);
});


test('standalone checkout includes local games and rejects sibling repository imports', t => {
  const f = fixture(t);
  f.write(path.join(f.native, 'bridge/host.ts'), "import { foo } from '../../Games/games/new/foo';");
  assert.throws(() => verifyRelativeImports(selectedFiles(f.config, f.native), f.native), /Import outside candidate/);
  f.write(path.join(f.native, 'bridge/host.ts'), "import { foo } from '../games/demo/main';");
  verifyRelativeImports(selectedFiles(f.config, f.native), f.native);
});


test('private model inputs are explicit, hashed and not required for unrelated apps', t => {
  const f = fixture(t), assets = path.join(f.native, 'local-assets');
  const bytes = 'model fixture';
  const sha = createHash('sha256').update(bytes).digest('hex');
  f.write(path.join(f.native, 'release/model-inputs.json'), { files: { 'demo/model.glb': sha } });
  assert.deepEqual(verifyModelInputs(['other'], f.native, assets), {});
  assert.throws(() => verifyModelInputs(['demo'], f.native, assets), /Missing user-provided model/);
  f.write(path.join(assets, 'demo/model.glb'), bytes);
  assert.deepEqual(verifyModelInputs(['demo'], f.native, assets), { 'demo/model.glb': sha });
  f.write(path.join(assets, 'demo/model.glb'), 'changed');
  assert.throws(() => verifyModelInputs(['demo'], f.native, assets), /Model input differs/);
});


test('freezing rejects empty Ruby checksums that break frozen installation', t => {
  const f = fixture(t), lock = path.join(f.native, 'examples/demo/Gemfile.lock');
  f.write(lock, 'CHECKSUMS\n  tool (1.2.3)\n\nBUNDLED WITH\n  4.0.16\n');
  assert.throws(() => verifyRubyLocks(f.config, f.native), /incomplete Ruby lock checksums/);
  f.write(lock, 'CHECKSUMS\n  tool (1.2.3) sha256=' + 'a'.repeat(64) + '\n\nBUNDLED WITH\n  4.0.16\n');
  verifyRubyLocks(f.config, f.native);
});


test('Podfile lock ignores generated checkout comments but rejects code and dependency drift', t => {
  const f = fixture(t), cwd = path.join(f.native, 'examples/demo');
  const source = "# Begin Podfile - /new checkout/node_modules/plugin/Podfile\nplatform :ios, '15.0'\n# NativeScriptPlatformSection /new checkout/node_modules/plugin/Podfile with 15.0\n";
  const normalized = normalizePodfile(source);
  const lock = text => 'PODFILE CHECKSUM: ' + createHash('sha1').update(text).digest('hex') + '\n\nCOCOAPODS: 1.17.0\n';
  f.write(path.join(cwd, 'locks/Podfile'), normalized);
  f.write(path.join(cwd, 'locks/Podfile.lock'), lock(normalized));
  f.write(path.join(cwd, 'platforms/ios/Podfile'), source);
  f.write(path.join(cwd, 'platforms/ios/Podfile.lock'), lock(source));
  verifyPodsLock(cwd);
  f.write(path.join(cwd, 'platforms/ios/Podfile'), source.replace('15.0', '16.0'));
  assert.throws(() => verifyPodsLock(cwd), /body differs/);
  f.write(path.join(cwd, 'platforms/ios/Podfile'), source);
  f.write(path.join(cwd, 'platforms/ios/Podfile.lock'), lock(source) + 'PODS:\n  - unexpected (1.0)\n');
  assert.throws(() => verifyPodsLock(cwd), /lock differs/);
  f.write(path.join(cwd, 'platforms/ios/Podfile.lock'), lock(normalized));
  assert.throws(() => verifyPodsLock(cwd), /checksum does not match/);
});
