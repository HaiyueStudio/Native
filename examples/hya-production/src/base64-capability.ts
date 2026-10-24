import {encodeBase64,decodeBase64} from './bytes-base64';

const invalid=()=>{const error=new TypeError('Invalid base64 or non-Latin1 binary string.');error.name='InvalidCharacterError';return error;};
/** Application-only binary-string boundary used by public integrity records; preserves any runtime implementation. */
export function acquireBase64Capability(scope:object):()=>void {
  const runtime=scope as {btoa?:unknown;atob?:unknown},cleanups:(()=>void)[]=[];
  const install=(key:'btoa'|'atob',value:(text:string)=>string)=>{
    if(typeof runtime[key]==='function')return;
    const previous=Object.getOwnPropertyDescriptor(scope,key);Object.defineProperty(scope,key,{value,configurable:true,writable:false});
    cleanups.push(()=>{if(Object.getOwnPropertyDescriptor(scope,key)?.value!==value)return;if(previous)Object.defineProperty(scope,key,previous);else Reflect.deleteProperty(scope,key);});
  };
  try {
    install('btoa',text=>{
      const binary=String(text);if(binary.length>64*1024*1024)throw new RangeError('Native binary string exceeds 64 MiB.');
      const bytes=new Uint8Array(binary.length);for(let index=0;index<binary.length;index++){const value=binary.charCodeAt(index);if(value>255)throw invalid();bytes[index]=value;}return encodeBase64(bytes);
    });
    install('atob',text=>{
      const binary=String(text).replace(/[\t\n\f\r ]/g,'');if(binary.length>Math.ceil(64*1024*1024/3)*4)throw new RangeError('Native base64 input exceeds the byte limit.');
      if(binary.length%4===1||!/^[A-Za-z0-9+/]*={0,2}$/.test(binary)||binary.includes('=')&&binary.length%4!==0)throw invalid();
      const padded=binary.padEnd(Math.ceil(binary.length/4)*4,'=');let bytes:Uint8Array;
      try{bytes=decodeBase64(padded);}catch{throw invalid();}
      const chunks:string[]=[];for(let index=0;index<bytes.length;index+=8192)chunks.push(String.fromCharCode(...bytes.subarray(index,index+8192)));return chunks.join('');
    });
  } catch(error){for(const cleanup of cleanups.reverse())cleanup();throw error;}
  let released=false;return()=>{if(released)return;released=true;for(const cleanup of cleanups.reverse())cleanup();};
}
