import {extname} from 'node:path';

// Only explicitly marked UTF-8 source/configuration files may normalize CRLF.
// Archives, images and other binary inputs always retain exact byte identity.
const textExtensions=new Set(['.ts','.js','.mjs','.json','.html','.md','.txt','.xml','.xcconfig','.plist','.resolved','.lock','.rb','.py']);
export function candidateBytes(item,bytes){
 if(item.normalization===undefined)return bytes;
 if(item.normalization!=='utf8-lf'||!textExtensions.has(extname(item.path)))throw Error('Unsupported candidate normalization: '+item.path);
 new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 return Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'),'utf8');
}
