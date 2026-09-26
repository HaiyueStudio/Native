import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';

// Compatibility backport for the example's pinned Engine 0.1.0 package. Keep
// unrelated in-progress Engine workspace changes out of the native release.
const edits = [
 ['    pressed = null;\n    roots = new Set();','    pressedPointers = new Map();\n    roots = new Set();'],
 ['            this.pressed = hit;','            this.pressedPointers.set(native.pointerId, hit);'],
 ['            const target = this.pressed ?? hit;','            const target = this.pressedPointers.get(native.pointerId) ?? hit;'],
 ['            const target = this.pressed ?? hit;','            const target = this.pressedPointers.get(native.pointerId);'],
 ['            this.pressed = null;','            this.pressedPointers.delete(native.pointerId);'],
 ['        this.disposed = true;\n        const canvas = this.engine.canvas;', '        this.disposed = true;\n        this.pressedPointers.clear();\n        const canvas = this.engine.canvas;'],
];
export function patchGuiInputSource(source) {
 if(source.includes('    pressedPointers = new Map();')) return source;
 for(const [before,after] of edits){
  if(!source.includes(before))throw new Error('Pinned GUI pointer implementation changed; re-audit the multitouch backport.');
  source=source.replace(before,after);
 }
 return source;
}
export function patchEngineInput() {
 const root=new URL('../node_modules/@haiyue/engine/',import.meta.url);
 const version=JSON.parse(readFileSync(new URL('package.json',root),'utf8')).version;
 if(version!=='0.1.0')throw new Error('Re-audit GUI multitouch backport for Engine '+version);
 const file=new URL('dist/chunks/GuiSystem-y6ULBwdc.js',root);
 const before=readFileSync(file,'utf8');
 const expected='453103666261601dbe87df7a473f8acfb8ab2ee353b78826c8566f623499df8b';
 let pristine=before;
 if(before.includes('    pressedPointers = new Map();')){
  for(const [oldText,newText] of [...edits].reverse())pristine=pristine.replace(newText,oldText);
 }
 if(createHash('sha256').update(pristine).digest('hex')!==expected)throw new Error('GUI input hash changed; refusing an unaudited patch.');
 const after=patchGuiInputSource(before);
 if(before!==after)writeFileSync(file,after);
 return {version,sha256:createHash('sha256').update(after).digest('hex')};
}
