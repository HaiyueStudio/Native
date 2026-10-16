import type {ScanCodeOptions,ScannedCode} from './types';
export async function scanPhoto(_options:ScanCodeOptions,_registerCancel:(fn:()=>void)=>void):Promise<ScannedCode|null>{throw Error('QR photos require an Android or iOS host');}
