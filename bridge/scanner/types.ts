/** The scanner returns text only. It never navigates URLs or executes payloads. */
export interface ScanCodeOptions { prompt?:string; cancelLabel?:string; maxTextLength?:number; }
export interface ScannedCode { text:string; format:'qr'; }
export function scanLimit(options:ScanCodeOptions={}):number {
 const max=options.maxTextLength??8192;
 if(!Number.isInteger(max)||max<1||max>1_000_000)throw Error('Invalid scanner size limit');
 return max;
}
export function scanText(text:unknown,options:ScanCodeOptions={}):ScannedCode {
 const max=scanLimit(options);
 if(typeof text!=='string'||!text.length||text.length>max)throw Error('Invalid or oversized QR content');
 return {text,format:'qr'};
}
