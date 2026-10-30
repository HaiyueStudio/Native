import {decodeBase64, encodeBase64} from './bytes-base64';
import {acquireSha256Digest} from './sha256-capability';
import {acquireBase64Capability} from './base64-capability';

declare const HYAByteIntegrity: {sha256Base64(encoded: string): string | null};
const abc = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const hex = (bytes: Uint8Array) => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
export async function prepareIosByteCapabilities(): Promise<() => void> {
  if (typeof HYAByteIntegrity === 'undefined') throw new Error('Native SHA-256 module metadata is unavailable; rebuild the app.');
  const native = (bytes: Uint8Array) => {
    const result = HYAByteIntegrity.sha256Base64(encodeBase64(bytes));
    if (result === null) throw new Error('Native SHA-256 rejected the encoded bytes.');
    return decodeBase64(result);
  };
  if (hex(native(new Uint8Array([97, 98, 99]))) !== abc) throw new Error('Native CommonCrypto SHA-256 known-vector check failed.');
  const release = acquireSha256Digest(globalThis, native);
  let releaseBase64:(()=>void)|undefined;
  try {
    releaseBase64=acquireBase64Capability(globalThis);
    if (typeof TextEncoder !== 'function' || typeof TextDecoder !== 'function' || typeof AbortController !== 'function' || typeof AggregateError !== 'function' || typeof structuredClone !== 'function') throw new Error('Native runtime is missing required text/cancellation/clone primitives.');
    if (hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array([97, 98, 99])))) !== abc) throw new Error('Application SHA-256 known-vector check failed.');
    if (new TextDecoder().decode(new TextEncoder().encode('你好 A')) !== '你好 A') throw new Error('Native UTF-8 roundtrip failed.');
    if(btoa('\u0000\u00ffA')!=='AP9B'||atob('AP9B')!=='\u0000\u00ffA')throw new Error('Native base64 binary-string check failed.');
    return()=>{releaseBase64?.();release();};
  } catch (error) {releaseBase64?.();release();throw error;}
}
