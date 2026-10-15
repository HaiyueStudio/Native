import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), output = resolve(root, 'build/web');
mkdirSync(output, { recursive: true });
await build({ entryPoints: [resolve(root, '../games/rubiks-cube/main.ts')], outfile: resolve(output, 'bundle.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022', nodePaths: [resolve(root, 'node_modules')], tsconfigRaw: {}, conditions: ['import'], mainFields: ['module', 'main'] });
writeFileSync(resolve(output, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Haiyue Rubik · Web</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#091321}canvas{width:100%;height:100%;touch-action:none}#status{position:absolute;top:8px;left:8px;color:white}#result{display:none}</style></head><body><canvas id="game-canvas"></canvas><div id="status" hidden></div><pre id="result"></pre><script type="module" src="./bundle.js"></script></body></html>');
console.log(output);
