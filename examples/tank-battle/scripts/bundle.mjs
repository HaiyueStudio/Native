import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { syncAssets } from './assets.mjs';
import { patchCanvas } from './patch-canvas.mjs';
const platform=process.argv[2];
if(!['android','ios'].includes(platform))throw new Error('Specify android or ios');
syncAssets();patchCanvas();
const app=fileURLToPath(new URL('../',import.meta.url));
const cli=fileURLToPath(new URL('../node_modules/webpack/bin/webpack.js',import.meta.url));
// Standalone JS/resource verification; native CLI build loads the full platform config.
const result=spawnSync(process.execPath,[cli,'--config','webpack.config.js','--env',platform,'--env','nativescriptLibPath'],{cwd:app,stdio:'inherit'});
if(result.error)throw result.error;process.exit(result.status??1);
