import {GPUBuffer} from '@nativescript/canvas';
/** Debug-only instrumentation; no per-frame filesystem work in normal play. */
export function probeGpu(){
 let maps=0;
 const map=GPUBuffer.prototype.mapAsync;
 GPUBuffer.prototype.mapAsync=function(...args){maps++;return map.apply(this,args);};
 return{snapshot:()=>({maps,fds:new java.io.File('/proc/self/fd').list()?.length??0}),dispose:()=>{GPUBuffer.prototype.mapAsync=map;}};
}
