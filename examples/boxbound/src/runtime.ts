import toReversed from 'core-js-pure/actual/array/virtual/to-reversed.js';
import findLastIndex from 'core-js-pure/actual/array/virtual/find-last-index.js';
/** NativeScript's Android V8 predates change-by-copy arrays. Keep the shared
 * game's semantics using the existing core-js implementation, only if absent. */
export function installGameRuntime(){
  if(!Array.prototype.toReversed)Object.defineProperty(Array.prototype,'toReversed',{value:toReversed,writable:true,configurable:true});
  if(!Array.prototype.findLastIndex)Object.defineProperty(Array.prototype,'findLastIndex',{value:findLastIndex,writable:true,configurable:true});
}
