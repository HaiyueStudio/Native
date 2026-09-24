import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const manifestPath = path.join(root, 'release/candidate.json');
export const readJSON = file => JSON.parse(readFileSync(file, 'utf8'));
export const hash = data => createHash('sha256').update(data).digest('hex');
export const readConfig = () => readJSON(path.join(root, 'release/config.json'));
export function command(command, args, cwd = root) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
export function gitFiles(dir) {
  return [...new Set(command('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], dir).split('\0').filter(Boolean))].sort();
}
const within = (file, prefix) => file === prefix || file.startsWith(`${prefix}/`);
export function selectedFiles(config, native = root, games = path.resolve(native, '../Games')) {
  const prefixes = ['bridge', 'scripts', 'test', 'release', ...Object.keys(config.apps).map(app => `examples/${app}`)];
  const files = {};
  for (const [repo, dir, select] of [
    ['Native', native, file => !file.includes('/') || prefixes.some(prefix => within(file, prefix))],
    ['Games', games, file => config.gamesInputs.some(prefix => within(file, prefix))],
  ]) {
    for (const file of gitFiles(dir)) {
      if (!select(file) || file === 'release/candidate.json' || file.split('/').includes('evidence')) continue;
      const absolute = path.join(dir, file);
      const stat = lstatSync(absolute); // A tracked deletion must fail, not silently disappear.
      if (!stat.isFile()) throw new Error(`Unsupported release input (must be regular file): ${repo}/${file}`);
      files[`${repo}/${file}`] = hash(readFileSync(absolute));
    }
  }
  for (const input of config.gamesInputs) {
    if (!Object.keys(files).some(file => within(file, `Games/${input}`))) throw new Error(`Missing Games input: ${input}`);
  }
  return files;
}
export function compareFiles(expected, actual) {
  const errors = [];
  for (const file of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    if (!(file in actual)) errors.push(`Missing: ${file}`);
    else if (!(file in expected)) errors.push(`Added: ${file}`);
    else if (expected[file] !== actual[file]) errors.push(`Changed: ${file}`);
  }
  if (errors.length) throw new Error(`Candidate drift:\n${errors.join('\n')}`);
}
export function dependencies(config, native = root) {
  const inventory = {};
  for (const app of Object.keys(config.apps)) {
    const dir = path.join(native, 'examples', app);
    const pkg = readJSON(path.join(dir, 'package.json'));
    const lock = readJSON(path.join(dir, 'package-lock.json'));
    if (pkg.version !== config.appVersion || pkg.license !== 'MIT' || lock.lockfileVersion !== 3 || lock.version !== pkg.version || lock.packages?.['']?.license !== 'MIT') {
      throw new Error(`${app}: expected version ${config.appVersion}, MIT metadata and lockfile v3`);
    }
    const direct = {};
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      const declared = pkg[section] ?? {}, locked = lock.packages[''][section] ?? {};
      if (JSON.stringify(Object.entries(declared).sort()) !== JSON.stringify(Object.entries(locked).sort())) throw new Error(`${app}: stale ${section} lockfile`);
      for (const [name, spec] of Object.entries(declared)) {
        if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(spec) && !/^file:vendor\/[\w.-]+\.tgz$/.test(spec)) throw new Error(`${app}: dependency must be exact: ${name}=${spec}`);
        const entry = lock.packages[`node_modules/${name}`];
        if (!entry) throw new Error(`${app}: missing locked dependency ${name}`);
        if (spec.startsWith('file:')) {
          const data = readFileSync(path.join(dir, spec.slice(5)));
          const integrity = `sha512-${createHash('sha512').update(data).digest('base64')}`;
          if (entry.resolved !== spec || entry.integrity !== integrity) throw new Error(`${app}: tarball/lock integrity differs: ${name}`);
          direct[name] = { spec, version: entry.version, sha256: hash(data) };
        } else {
          if (entry.version !== spec) throw new Error(`${app}: locked version differs: ${name}`);
          direct[name] = { spec, version: entry.version };
        }
      }
    }
    const packages = {};
    for (const [location, entry] of Object.entries(lock.packages)) {
      if (!location) continue;
      if (entry.link || !entry.version || !entry.resolved || !entry.integrity) throw new Error(`${app}: incomplete locked dependency: ${location}`);
      packages[location] = { version: entry.version, resolved: entry.resolved, integrity: entry.integrity, license: entry.license ?? 'UNDECLARED' };
    }
    inventory[app] = { direct, packages };
  }
  return inventory;
}
export function verifyInstalled(app, native = root) {
  const dir = path.join(native, 'examples', app);
  const lock = readJSON(path.join(dir, 'package-lock.json'));
  for (const [location, entry] of Object.entries(lock.packages)) {
    if (!location) continue;
    const file = path.join(dir, location, 'package.json');
    if (!existsSync(file) && entry.optional) continue;
    if (!existsSync(file) || readJSON(file).version !== entry.version) throw new Error(`${app}: installed dependency differs: ${location}; run npm ci`);
  }
  command('npm', ['ls', '--all', '--json'], dir);
  const pkg = readJSON(path.join(dir, 'package.json'));
  for (const [name, spec] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
    if (!spec.startsWith('file:vendor/')) continue;
    const archive = path.join(dir, spec.slice(5));
    const files = command('tar', ['-tzf', archive]).split('\n');
    if (files.some(file => !file.startsWith('package/') || file.split('/').includes('..'))) throw new Error(`Unexpected tarball paths: ${name}`);
    const temp = mkdtempSync(path.join(tmpdir(), 'native-vendor-'));
    try {
      command('tar', ['-xzf', archive, '-C', temp]);
      for (const file of files) {
        const source = path.join(temp, file);
        if (lstatSync(source).isDirectory()) continue;
        if (!lstatSync(source).isFile()) throw new Error(`Unsupported tarball entry: ${name}/${file}`);
        const installed = path.join(dir, 'node_modules', name, file.slice('package/'.length));
        if (!existsSync(installed) || !readFileSync(source).equals(readFileSync(installed))) throw new Error(`${app}: installed vendor content differs: ${name}/${file}; run npm ci`);
      }
    } finally { rmSync(temp, { recursive: true, force: true }); }
  }
}
export function verifyCandidate(config = readConfig()) {
  const candidate = readJSON(manifestPath);
  if (candidate.schemaVersion !== 1 || candidate.candidate !== config.candidate) throw new Error('Candidate/config identity mismatch');
  compareFiles(candidate.files, selectedFiles(config));
  verifyRelativeImports(candidate.files);
  const current = dependencies(config);
  if (JSON.stringify(current) !== JSON.stringify(candidate.dependencies)) throw new Error('Dependency inventory differs from candidate');
  const pkg = readJSON(path.join(root, 'package.json'));
  if (pkg.version !== config.candidate || pkg.license !== 'MIT' || !readFileSync(path.join(root, 'LICENSE'), 'utf8').startsWith('MIT License')) throw new Error('Repository version/license mismatch');
  return candidate;
}

/** A new cross-directory import must not silently escape the frozen input set. */
export function verifyRelativeImports(files, workspace = path.resolve(root, '..')) {
  for (const file of Object.keys(files)) {
    if (!file.endsWith('.ts')) continue;
    const source = readFileSync(path.join(workspace, file), 'utf8');
    const imports = source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"](\.[^'"]+)['"]/g);
    for (const [, specifier] of imports) {
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
      const candidates = [resolved, ...['.ts', '.ios.ts', '.android.ts', '.json', '.js', '/index.ts'].map(ext => resolved + ext)];
      if (!candidates.some(name => name in files)) throw new Error(`Import outside candidate: ${file} -> ${specifier}`);
    }
  }
}
