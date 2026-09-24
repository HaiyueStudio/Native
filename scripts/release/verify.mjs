import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { root, manifestPath, readConfig, readJSON, hash, command, verifyCandidate, verifyInstalled, verifyModelInputs, verifyPodsLock } from './common.mjs';
import { runLogged, runStages } from './runner.mjs';

const report = { schemaVersion: 1, startedAt: new Date().toISOString(), status: 'failed', stages: [], skipped: [] };
const output = path.join(root, 'artifacts/release', report.startedAt.replace(/[:.]/g, '-'));
mkdirSync(output, { recursive: true });
try {
  const { values } = parseArgs({ options: {
    profile: { type: 'string', default: 'source' }, app: { type: 'string' }, platform: { type: 'string' },
    install: { type: 'boolean', default: false },
  } });
  const config = readConfig();
  const { profile, platform } = values;
  if (!['source', 'bundle', 'build'].includes(profile)) throw new Error('profile must be source, bundle or build');
  if (platform && !['ios', 'android'].includes(platform)) throw new Error('platform must be ios or android');
  if (profile !== 'source' && !platform) throw new Error('bundle/build requires --platform ios|android');
  if (values.app && !Object.hasOwn(config.apps, values.app)) throw new Error(`Unknown app: ${values.app}`);
  const apps = values.app ? [values.app] : Object.keys(config.apps).filter(app => !platform || config.apps[app].includes(platform));
  if (platform && apps.some(app => !config.apps[app].includes(platform))) throw new Error('Unsupported app/platform combination');
  Object.assign(report, { candidate: config.candidate, profile, platform: platform ?? null, apps,
    qualification: 'Only the listed stages; not App Store / Play Store or device acceptance.',
    toolchain: { node: process.versions.node, npm: command('npm', ['--version']) },
  });
  const env = { ...process.env, DEVELOPER_DIR: process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer' };
  const stages = [];
  const stage = (name, run) => stages.push({ name, run });
  const run = (name, bin, args, cwd = root, extraEnv = {}) => stage(name, () => runLogged(bin, args, { cwd, env: { ...env, ...extraEnv }, log: path.join(output, `${name}.log`) }));
  stage('candidate-integrity', () => { verifyCandidate(config); report.manifestSha256 = hash(readFileSync(manifestPath)); });
  stage('node-toolchain', () => {
    for (const name of ['node', 'npm']) if (report.toolchain[name] !== config.toolchain[name]) throw new Error(`${name}: expected ${config.toolchain[name]}, got ${report.toolchain[name]}`);
  });
  run('release-tests', 'npm', ['test']);
  for (const app of apps) {
    const cwd = path.join(root, 'examples', app);
    if (values.install) run(`${app}-install`, 'npm', ['ci', '--registry=https://registry.npmjs.org', '--no-audit', '--no-fund'], cwd);
    stage(`${app}-dependencies`, () => verifyInstalled(app));
    run(`${app}-typecheck`, 'npm', ['run', 'typecheck'], cwd);
    run(`${app}-tests`, 'npm', ['test'], cwd);
  }
  if (profile !== 'source') {
    stage('model-inputs', () => { report.modelInputs = verifyModelInputs(apps); });
    stage('native-toolchain', () => {
      const check = (name, got, expected = config.toolchain[name]) => {
        report.toolchain[name] = got;
        if (got !== expected) throw new Error(`${name}: expected ${expected}, got ${got}`);
      };
      if (apps.some(app => ['neon-circuit', 'ak47-range', 'sky-strike'].includes(app))) {
        const python = env.PYTHON || 'python3';
        const versions = command(python, ['-c', 'import platform,PIL; print(platform.python_version()); print(PIL.__version__)']).split('\n');
        check('python', versions[0]); check('pillow', versions[1]);
      }
      if (platform === 'ios') {
        check('ruby', command('ruby', ['-e', 'print RUBY_VERSION']));
        check('bundler', command('bundle', ['--version']).split(' ').at(-1));
        // Xcode is selected per process, without changing the machine-wide developer directory.
        check('xcode', command('env', [`DEVELOPER_DIR=${env.DEVELOPER_DIR}`, 'xcodebuild', '-version']));
        for (const app of apps) {
          const cwd = path.join(root, 'examples', app);
          const version = command('bundle', ['exec', 'pod', '--version'], cwd);
          if (version !== config.toolchain.cocoapods) throw new Error(`${app}: CocoaPods version differs`);
        }
      } else {
        const tools = path.join(root, '.android-tools');
        const jdkDir = path.join(tools, 'jdk');
        const javaHome = env.JAVA_HOME || path.join(jdkDir, readdirSync(jdkDir).find(name => name.startsWith('jdk-')) ?? '', 'Contents/Home');
        const sdk = env.ANDROID_HOME || path.join(tools, 'sdk');
        const properties = command(path.join(javaHome, 'bin/java'), ['--version']).split('\n')[0];
        check('java', properties.split(' ')[1]);
        for (const relative of [`platforms/android-${config.toolchain.androidPlatform}/android.jar`, `build-tools/${config.toolchain.androidBuildTools}/aapt2`]) {
          if (!existsSync(path.join(sdk, relative))) throw new Error(`Missing Android SDK: ${relative}`);
        }
        Object.assign(env, { JAVA_HOME: javaHome, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, GRADLE_USER_HOME: env.GRADLE_USER_HOME || path.join(tools, 'gradle') });
        report.toolchain.androidPlatform = config.toolchain.androidPlatform;
        report.toolchain.androidBuildTools = config.toolchain.androidBuildTools;
      }
    });
    for (const app of apps) {
      const script = profile === 'bundle' ? `bundle:${platform}` : platform === 'ios' ? 'build:device' : 'build:android';
      const cwd = path.join(root, 'examples', app);
      run(`${app}-${profile}-${platform}`, 'npm', ['run', script], cwd);
      if (platform === 'android') {
        stage(`${app}-gradle-version`, () => {
          const wrapper = readFileSync(path.join(cwd, 'platforms/android/gradle/wrapper/gradle-wrapper.properties'), 'utf8');
          if (!wrapper.includes(`gradle-${config.toolchain.gradle}-bin.zip`)) throw new Error('Gradle wrapper version differs');
          report.toolchain.gradle = config.toolchain.gradle;
        });
        run(`${app}-maven-lock`, './gradlew', [':app:verifyReleaseDependencies', '--console=plain'], path.join(cwd, 'platforms/android'));
        if (profile === 'build') stage(`${app}-artifact`, () => {
          const file = path.join(cwd, 'platforms/android/app/build/outputs/apk/debug/app-debug.apk');
          report.artifacts = [...(report.artifacts ?? []), { app, platform, file, sha256: hash(readFileSync(file)), kind: 'debug-apk' }];
        });
      } else {
        stage(`${app}-pods-lock`, () => verifyPodsLock(cwd));
        if (profile === 'build') stage(`${app}-swiftpm-lock`, () => {
          const workspace = readdirSync(path.join(cwd, 'platforms/ios')).find(name => name.endsWith('.xcworkspace'));
          const actual = readJSON(path.join(cwd, 'platforms/ios', workspace, 'xcshareddata/swiftpm/Package.resolved'));
          const expected = readJSON(path.join(cwd, 'locks/Package.resolved'));
          if (JSON.stringify(actual.pins) !== JSON.stringify(expected.pins)) throw new Error('Resolved SwiftPM revisions differ');
        });
      }
    }
  }
  stage('candidate-integrity-after-validation', () => verifyCandidate(config));
  if (profile !== 'source') stage('model-inputs-after-validation', () => verifyModelInputs(apps));
  report.skipped.push('Device install/interaction, signing/export and store submission are not performed by this gate.');
  if (profile === 'source') report.skipped.push('Native bundle/build: request --profile bundle|build --platform ios|android.');
  if (profile === 'bundle') report.skipped.push('Native binary build: request --profile build.');
  const passed = await runStages(stages, report, result => console.log(`[${result.status}] ${result.name}${result.error ? `: ${result.error}` : ''}`));
  if (!passed) process.exitCode = 1;
} catch (error) {
  report.status = 'failed'; report.error = error.message;
  console.error(error.message); process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(path.join(root, 'artifacts/release/latest.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Release report: ${path.join(output, 'report.json')}`);
}
