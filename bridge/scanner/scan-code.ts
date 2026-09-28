import type {ScanCodeOptions,ScannedCode} from './types';
export type {ScanCodeOptions,ScannedCode} from './types';
export async function scanCode(_options:ScanCodeOptions={}):Promise<ScannedCode|null>{throw Error('QR scanning requires an Android or iOS host');}
export function cancelScan():void {}
