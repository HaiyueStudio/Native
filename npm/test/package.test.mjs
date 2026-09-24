import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const packageRoot = process.env.NATIVE_PACKAGE_ROOT ? path.resolve(process.env.NATIVE_PACKAGE_ROOT) : root;
const require = createRequire(import.meta.url);
const webpack = require('webpack');
const { PlatformSuffixPlugin } = require('@nativescript/webpack/dist/plugins/PlatformSuffixPlugin');
const nativeClass = require('@nativescript/webpack/dist/transformers/NativeClass').default;
const pkg = JSON.parse(readFileSync(path.join(packageRoot, 'package.json')));

test('package contains only native capabilities and verified bridge inputs', t => {
  const temp = mkdtempSync(path.join(tmpdir(), 'native-pack-test-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const [packed] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--cache', temp], { cwd: packageRoot, encoding: 'utf8' }));
  assert.ok(packed.size < 512 * 1024, 'native package should remain below 512 KiB');
  assert.equal(pkg.bin, undefined);
  assert.equal(pkg.dependencies, undefined, 'runtime dependencies are app-owned peers');
  for (const { path: file } of packed.files) {
    assert.ok(['index.ts', 'package.json', 'provenance.json', 'README.md', 'LICENSE'].includes(file)
      || /^bridge\/.+\.(ts|cjs|java|swift)$/.test(file)
      || file === 'bridge/branding/assets/haiyue-moon.png', file);
    assert.doesNotMatch(file, /(?:examples|games|node_modules|vendor|evidence|dist|bin)\/|master\.png|\.tgz$/);
  }
  const provenance = JSON.parse(readFileSync(path.join(packageRoot, 'provenance.json')));
  const names = new Set(packed.files.map(file => file.path));
  for (const [file, sha] of Object.entries(provenance.files)) {
    assert.ok(names.has(file), `missing ${file}`);
    assert.equal(createHash('sha256').update(readFileSync(path.join(packageRoot, file))).digest('hex'), sha, file);
  }
});

for (const platform of ['ios', 'android']) test(`NativeScript ${platform} resolves public entry points to its own platform`, async t => {
  const temp = mkdtempSync(path.join(tmpdir(), `native-${platform}-bundle-`));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const entry = path.join(temp, 'entry.js');
  mkdirSync(path.join(temp, 'node_modules/@haiyue'), { recursive: true });
  symlinkSync(packageRoot, path.join(temp, 'node_modules/@haiyue/native'), 'dir');
  writeFileSync(entry, `import * as native from '@haiyue/native';\nimport { NativeDeviceMotion } from '@haiyue/native/motion';\nimport { NativeHaptics } from '@haiyue/native/feedback';\nimport * as audio from '@haiyue/native/audio';\nimport * as orientation from '@haiyue/native/orientation';\nimport * as media from '@haiyue/native/media';\nglobalThis.nativeSmoke = { native, NativeDeviceMotion, NativeHaptics, audio, orientation, media };`);
  const compiler = webpack({
    mode: 'development', context: temp, entry, devtool: false,
    output: { path: temp, filename: 'bundle.js' },
    resolve: {
      modules: [path.join(temp, 'node_modules'), path.join(root, 'node_modules'), 'node_modules'],
      extensions: [`.${platform}.ts`, '.native.ts', '.ts', `.${platform}.js`, '.js', '.cjs', '.json'],
      fullySpecified: false,
    },
    plugins: [new PlatformSuffixPlugin({ extensions: [platform, 'native'] })],
    externals: [({ request }, callback) => {
      if (request && !request.startsWith('.') && !path.isAbsolute(request) && !request.startsWith('@haiyue/native'))
        return callback(null, `commonjs ${request}`);
      callback();
    }],
    module: { rules: [{ test: /\.ts$/, use: [
      { loader: require.resolve('ts-loader'), options: {
        configFile: path.join(root, 'tsconfig.json'), transpileOnly: true, allowTsInNodeModules: true,
        compilerOptions: { noEmit: false, declaration: false },
        getCustomTransformers: () => ({ before: [nativeClass] }),
      } },
      require.resolve('@nativescript/webpack/dist/loaders/native-class-downlevel-loader'),
      require.resolve('@nativescript/webpack/dist/loaders/native-class-strip-loader'),
    ] }] },
  });
  const stats = await new Promise((resolve, reject) => compiler.run((error, stats) => {
    compiler.close(closeError => error || closeError ? reject(error || closeError) : resolve(stats));
  }));
  assert.equal(stats.hasErrors(), false, stats.toString({ all: false, errors: true }));
  const modules = stats.toJson({ all: false, modules: true }).modules.map(m => m.name).join('\n');
  for (const unit of ['motion/device-motion', 'feedback/haptics', 'display/orientation', 'input/native-touch', 'audio/pcm-bank', 'render/view-rect']) {
    assert.ok(modules.includes(`${unit}.${platform}.ts`), `${unit}: ${modules}`);
    assert.ok(!modules.includes(`${unit}.${platform === 'ios' ? 'android' : 'ios'}.ts`), `${unit}: wrong platform`);
  }
  if (platform === 'ios') assert.doesNotMatch(readFileSync(path.join(temp, 'bundle.js'), 'utf8'), /NativeClass\(\)/);
});
