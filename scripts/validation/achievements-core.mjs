import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const directory = mkdtempSync(join(tmpdir(), 'haiyue-achievements-consumer-'));
const pkg = join(directory, 'node_modules/@haiyue/native'); mkdirSync(pkg, { recursive: true });
// Use the real package staging filter and full export map, with no runtime peers installed.
// This checks import isolation; npm's legacy NativeScript peer declarations are unchanged.
const staged = execFileSync(process.execPath, [join(root, 'npm/stage-development.mjs')], { cwd: root, encoding: 'utf8' }).trim();
cpSync(staged, pkg, { recursive: true });
writeFileSync(join(directory, 'consumer.ts'), `
import { createAchievements, createAchievementStorage, type AchievementPort } from '@haiyue/native/achievements';
import { createLocalAchievementProvider } from '@haiyue/native/achievements/local';
const map = new Map<string, string>();
const store = createAchievementStorage({getItem: k => map.get(k) ?? null, setItem: (k,v) => {map.set(k,v);}});
const client = createAchievements({catalog:{schemaVersion:1,gameId:'test',environment:'test',version:'1',definitions:[{id:'win',target:1,titleKey:'win',descriptionKey:'win.desc'}]},provider:createLocalAchievementProvider('app'),storage:store,guestProfile:'guest'});
const port: AchievementPort = client;
await client.initialize(); await port.unlock('win');
if((await client.load())[0].value!==1) throw new Error('Consumer failed');
client.dispose();
console.log('Engine-free consumer passed');
`);
execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--target', 'ES2022', '--module', 'esnext', '--moduleResolution', 'bundler', '--lib', 'ES2022,DOM', join(directory, 'consumer.ts')], { stdio: 'inherit' });
// Bundle only the isolated consumer to verify that runtime imports remain Engine-free.
const bundle = await import(join(root, 'desktop/node_modules/esbuild/lib/main.js'));
await bundle.build({ entryPoints: [join(directory, 'consumer.ts')], outfile: join(directory, 'consumer.mjs'), format: 'esm', bundle: true, platform: 'node', target: 'node22', tsconfigRaw: {} });
execFileSync(process.execPath, [join(directory, 'consumer.mjs')], { stdio: 'inherit' });
console.log(JSON.stringify({ directory, installedRuntimePackages: ['@haiyue/native'], typecheck: 'passed', runtime: 'passed' }));
