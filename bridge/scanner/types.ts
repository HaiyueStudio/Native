/** The scanner returns text only. It never navigates URLs or executes payloads. */
export interface ScanCodeOptions { source?:'camera'|'photos'; prompt?:string; cancelLabel?:string; maxTextLength?:number; }
export interface ScannedCode { text:string; format:'qr'; }
export function scanLimit(options:ScanCodeOptions={}):number {
 if(options.source!==undefined&&options.source!=='camera'&&options.source!=='photos')throw Error('Invalid scanner source');
 const max=options.maxTextLength??8192;
 if(!Number.isInteger(max)||max<1||max>1_000_000)throw Error('Invalid scanner size limit');
 return max;
}
/** Do not silently pick an arbitrary puzzle when an image contains several codes. */
export function scanImageTexts(texts:readonly string[],options:ScanCodeOptions={}):ScannedCode {
 const unique=[...new Set(texts.filter(Boolean))];
 if(!unique.length)throw Error('No QR code in image');
 if(unique.length!==1)throw Error('Multiple QR codes in image');
 return scanText(unique[0],options);
}
export function scanText(text:unknown,options:ScanCodeOptions={}):ScannedCode {
 const max=scanLimit(options);
 if(typeof text!=='string'||!text.length||text.length>max)throw Error('Invalid or oversized QR content');
 return {text,format:'qr'};
}
