import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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
  assert.equal(pkg.peerDependenciesMeta?.['@haiyue/engine']?.optional, true);
  assert.equal(pkg.exports['./engine'], './bridge/engine.ts');
  assert.equal(pkg.dependencies, undefined, 'runtime dependencies are app-owned peers');
  for (const { path: file } of packed.files) {
    assert.ok(['index.ts', 'package.json', 'provenance.json', 'README.md', 'LICENSE'].includes(file)
      || /^bridge\/.+\.(ts|cjs|java|swift|md)$/.test(file)
      || file === 'bridge/share/android/haiyue_share_paths.xml'
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

for (const platform of ['ios', 'android']) for (const systemOnly of [false, true]) test(`NativeScript ${platform}: ${systemOnly ? 'system entries without Engine' : 'compatible root and Engine adapter'}`, async t => {
  const temp = mkdtempSync(path.join(tmpdir(), `native-${platform}-bundle-`));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const entry = path.join(temp, 'entry.js');
  mkdirSync(path.join(temp, 'node_modules/@haiyue'), { recursive: true });
  const [packed] = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--cache', temp, '--pack-destination', temp], { cwd: packageRoot, encoding: 'utf8' }));
  execFileSync('tar', ['-xzf', path.join(temp, packed.filename), '-C', temp]);
  symlinkSync(path.join(temp, 'package'), path.join(temp, 'node_modules/@haiyue/native'), 'dir');
  const { monetizationBuild } = createRequire(entry)('@haiyue/native/monetization/build');
  const build = monetizationBuild({ purchases: true, development: true, rewards: {
    iosAppId: 'ca-app-pub-3940256099942544~1458002511', androidAppId: 'ca-app-pub-3940256099942544~3347511713',
  } });
  for (const [feature, swift, java] of [
    ['purchases', 'HYNonConsumableStore.swift', 'org/haiyue/purchases/HYPlayBilling.java'],
    ['rewards', 'HYRewardedAds.swift', 'org/haiyue/rewards/HYRewardedAds.java'],
  ]) {
    const nativeRoot = realpathSync(path.join(temp, 'package/bridge', feature, 'native'));
    assert.ok(build.ios.NativeSource.some(source => !path.isAbsolute(source.path) && path.resolve(source.path) === path.join(nativeRoot, 'ios/*.swift')));
    assert.ok(existsSync(path.join(nativeRoot, 'ios', swift)));
    assert.ok(build.androidGradle.includes(path.join(nativeRoot, 'android')));
    assert.ok(existsSync(path.join(nativeRoot, 'android', java)));
  }
  let entrySource = `import * as native from '@haiyue/native';\nimport * as engineAdapter from '@haiyue/native/engine';\nimport { NativeDeviceMotion } from '@haiyue/native/motion';\nimport { NativeHaptics } from '@haiyue/native/feedback';\nimport * as audio from '@haiyue/native/audio';\nimport * as orientation from '@haiyue/native/orientation';\nimport * as media from '@haiyue/native/media';\nimport { scanCode, cancelScan } from '@haiyue/native/scanner';\nimport { shareContent, canShareContent } from '@haiyue/native/share';\nimport { createPurchases } from '@haiyue/native/purchases/native';\nimport { PurchaseController, PurchaseCatalog } from '@haiyue/native/purchases';\nimport { createRewards } from '@haiyue/native/rewards/native';\nglobalThis.nativeSmoke = { native, engineAdapter, NativeDeviceMotion, NativeHaptics, audio, orientation, media, scanCode, cancelScan, shareContent, canShareContent, createPurchases, PurchaseController, PurchaseCatalog, createRewards };`;
  if (systemOnly) entrySource = entrySource
    .replace("import * as native from '@haiyue/native';\n", '')
    .replace("import * as engineAdapter from '@haiyue/native/engine';\n", '')
    .replace('native, engineAdapter, ', '');
  writeFileSync(entry, entrySource);
  {
    // Typecheck both consumer modes against real package exports. Rendering uses
    // our registry-pinned minimum Engine; system consumers have no Engine install.
    if (!systemOnly) symlinkSync(path.join(root, 'node_modules/@haiyue/engine'), path.join(temp, 'node_modules/@haiyue/engine'), 'dir');
    assert.equal(existsSync(path.join(temp, 'node_modules/@haiyue/engine')), !systemOnly);
    for (const scope of ['@nativescript', '@webgpu'])
      symlinkSync(path.join(root, 'node_modules', scope), path.join(temp, 'node_modules', scope), 'dir');
    const typesEntry = path.join(temp, 'consumer.ts');
    writeFileSync(typesEntry, entrySource.replace('globalThis.nativeSmoke =', 'export const nativeSmoke ='));
    const config = path.join(temp, 'tsconfig.json');
    writeFileSync(config, JSON.stringify({ compilerOptions: {
      strict: true, target: 'ES2020', module: 'esnext', moduleResolution: 'bundler',
      lib: ['ES2022','DOM'], types: ['@nativescript/types','@webgpu/types'],
      skipLibCheck: true, noEmit: true, experimentalDecorators: true,
    }, include: [typesEntry] }));
    execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', config], {stdio:'pipe'});
  }
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
      if (systemOnly && /^@haiyue\/engine(?:\/|$)/.test(request ?? ''))
        return callback(new Error('System capabilities must not load Engine: ' + request));
      // Bundle the actual Engine exports so missing/incompatible runtime imports
      // cannot be hidden by treating the entire Engine as an external dependency.
      if (request && !request.startsWith('.') && !path.isAbsolute(request) && !request.startsWith('@haiyue/native') && !/^@haiyue\/engine(?:\/|$)/.test(request))
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
  for (const unit of ['motion/device-motion', 'feedback/haptics', 'display/orientation', 'audio/pcm-bank', 'purchases/store', 'scanner/scan-code', 'share/share-content', ...(systemOnly ? [] : ['input/native-touch', 'render/view-rect'])]) {
    assert.ok(modules.includes(`${unit}.${platform}.ts`), `${unit}: ${modules}`);
    assert.ok(!modules.includes(`${unit}.${platform === 'ios' ? 'android' : 'ios'}.ts`), `${unit}: wrong platform`);
  }
  if (systemOnly) assert.doesNotMatch(modules, /@haiyue\/engine|lifecycle\/host|render\/surface|bridge\/engine/);
  else {
    assert.match(modules, /bridge\/engine/);
    assert.match(modules, /lifecycle\/host/);
    assert.match(modules, /@haiyue\/engine\/dist\//);
  }
  if (platform === 'ios') assert.doesNotMatch(readFileSync(path.join(temp, 'bundle.js'), 'utf8'), /NativeClass\(\)/);
});

test('Web share public entries compile without NativeScript, Engine or platform globals', async t => {
  const temp = mkdtempSync(path.join(tmpdir(), 'native-web-share-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  mkdirSync(path.join(temp, 'node_modules/@haiyue'), { recursive: true });
  symlinkSync(packageRoot, path.join(temp, 'node_modules/@haiyue/native'), 'dir');
  const entry = path.join(temp, 'entry.ts');
  writeFileSync(entry, `import { shareContent, type ShareContent } from '@haiyue/native/share';
import { canShareContent } from '@haiyue/native/share/web';
const value: ShareContent = {text:'Demo score'};
export const supported = canShareContent(value);
export const onClick = () => shareContent(value);`);
  const config = path.join(temp, 'tsconfig.json');
  writeFileSync(config, JSON.stringify({ compilerOptions: {
    strict: true, target: 'ES2020', module: 'esnext', moduleResolution: 'bundler', lib: ['ES2022','DOM'], types: [], noEmit: true,
  }, include: [entry] }));
  execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', config], {stdio:'pipe'});
  const compiler = webpack({ mode:'development', target:'web', context:temp, entry, devtool:false,
    output:{path:temp,filename:'bundle.js'}, resolve:{extensions:['.ts','.js'],fullySpecified:false},
    module:{rules:[{test:/\.ts$/,use:[{loader:require.resolve('ts-loader'),options:{
      configFile:config,transpileOnly:true,allowTsInNodeModules:true,compilerOptions:{noEmit:false},
    }}]}]},
  });
  const stats = await new Promise((resolve,reject) => compiler.run((error,stats) => compiler.close(closeError => error||closeError ? reject(error||closeError) : resolve(stats))));
  assert.equal(stats.hasErrors(),false,stats.toString({all:false,errors:true}));
  const modules=stats.toJson({all:false,modules:true}).modules.map(m=>m.name).join('\n');
  assert.match(modules,/share-content.web.ts/);
  assert.doesNotMatch(modules,/@nativescript|share-content\.(ios|android)\.ts|@haiyue\/engine/);
});
