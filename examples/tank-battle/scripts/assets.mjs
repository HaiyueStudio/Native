import { mkdirSync, copyFileSync } from 'node:fs';
const source=new URL('../../../games/tank-battle/assets/',import.meta.url);
const output=new URL('../src/game-assets/',import.meta.url);
export function syncAssets(){
 mkdirSync(output,{recursive:true});
 for(const name of ['controls','mobile-atlas'])for(const extension of ['json','rgba'])copyFileSync(new URL(`${name}.${extension}`,source),new URL(`${name}.${extension}`,output));
 for(const name of ['shoot','hit','explode','pickup','over','clear'])copyFileSync(new URL(`${name}.wav`,source),new URL(`${name}.wav`,output));
}
syncAssets();
