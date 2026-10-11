import { build } from 'esbuild';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = await build({ entryPoints: [resolve(root, 'sample/main.ts')], outfile: resolve(root, 'build/main.js'),
  bundle: true, format: 'esm', platform: 'neutral', target: 'es2022',
  nodePaths: [resolve(root, 'node_modules')], external: ['@napi-rs/canvas', 'node:*'],
  tsconfigRaw: { compilerOptions: {} }, conditions: ['import'], mainFields: ['module', 'main'], sourcemap: true, metafile: true });
for (const input of Object.keys(result.metafile.inputs)) {
  const local = relative(resolve(root, '..'), resolve(input));
  if (local.startsWith('..') || isAbsolute(local)) throw new Error(`Cross-repository source dependency: ${input}`);
  if (input.includes('@haiyue/engine') && !resolve(input).startsWith(resolve(root, 'node_modules/@haiyue/engine'))) throw new Error(`Engine must resolve from the pinned desktop package: ${input}`);
}
writeFileSync(resolve(root, 'build/metafile.json'), JSON.stringify(result.metafile, null, 2) + '\n');
