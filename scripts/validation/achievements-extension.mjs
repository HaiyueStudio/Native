import { cpSync, mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), fresh = mkdtempSync(join(tmpdir(), 'haiyue-achievement-contract-'));
const staged = execFileSync(process.execPath, [join(root, 'npm/stage-development.mjs')], { cwd: root, encoding: 'utf8' }).trim();
const modules = join(fresh, 'node_modules/@haiyue'); mkdirSync(modules, { recursive: true }); cpSync(staged, join(modules, 'native'), { recursive: true });
for (const [name, archive] of [['engine', 'haiyue-engine-0.2.1.tgz'], ['extensions', 'haiyue-extensions-0.2.1-p1.tgz']]) {
  const target = join(modules, name); mkdirSync(target, { recursive: true });
  execFileSync('tar', ['-xzf', join(root, 'desktop/vendor', archive), '--strip-components=1', '-C', target]);
}
writeFileSync(join(fresh, 'package.json'), '{"private":true,"type":"module"}');
writeFileSync(join(fresh, 'consumer.ts'), `
import { createAchievements, createAchievementStorage } from '@haiyue/native/achievements';
import { createLocalAchievementProvider } from '@haiyue/native/achievements/local';
import { createSteamAchievementProvider } from '@haiyue/native/achievements/steam';
import { createGameCenterAchievementProvider } from '@haiyue/native/achievements/game-center';
import { AchievementRuntime, type AchievementPort } from '@haiyue/extensions/achievements';
const data = new Map<string,string>();
const definitions = [{id:'win',target:1,titleKey:'win',descriptionKey:'win.desc',rule:{kind:'fact' as const,event:'win'}}];
const facade=createAchievements({catalog:{schemaVersion:1,gameId:'test',environment:'test',version:'1',definitions},provider:createLocalAchievementProvider('test'),guestProfile:'guest',storage:createAchievementStorage({getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v)}})});
await facade.initialize(); const port:AchievementPort=facade;
const rules=new AchievementRuntime({definitions,definitionVersion:'1',profile:'test/guest',port,storage:{async read(k){return JSON.parse(data.get(k)??'null')},async write(k,v){data.set(k,JSON.stringify(v))}}});
await rules.initialize(); await rules.record({id:'1',type:'win'}); await rules.sync();
if((await facade.load())[0].value!==1)throw Error('Facade/extension mismatch');
rules.dispose(); facade.dispose();
if(typeof createSteamAchievementProvider!=='function'||typeof createGameCenterAchievementProvider!=='function')throw Error('Provider export missing');
console.log('Packed facade/extension consumer passed');
`);
execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--strict', '--noEmit', '--skipLibCheck', '--target', 'ES2022', '--module', 'esnext', '--moduleResolution', 'bundler', '--lib', 'ES2022,DOM', join(fresh, 'consumer.ts')], { stdio: 'inherit' });
const { build } = await import(join(root, 'desktop/node_modules/esbuild/lib/main.js'));
const result = await build({ entryPoints: [join(fresh, 'consumer.ts')], outfile: join(fresh, 'consumer.mjs'), bundle: true, format: 'esm', platform: 'node', tsconfigRaw: {}, metafile: true });
if (Object.keys(result.metafile.inputs).some(p => p.includes('@nativescript') || p.includes('platform-libs') || p.includes('/Engine/'))) throw new Error('Consumer leaked a runtime/platform/source dependency');
execFileSync(process.execPath, [join(fresh, 'consumer.mjs')], { stdio: 'inherit' });
console.log(JSON.stringify({ directory: fresh, extensionArchiveSha256: createHash('sha256').update(readFileSync(join(root, 'desktop/vendor/haiyue-extensions-0.2.1-p1.tgz'))).digest('hex'), status: 'passed' }));
