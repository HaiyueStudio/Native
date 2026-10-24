const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** Explicit byte transport at the example's NativeScript boundary; no DOM/global shim. */
export function encodeBase64(bytes: Uint8Array): string {
  const chunks: string[] = []; let chunk = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index]!, b = bytes[index + 1], c = bytes[index + 2];
    chunk += alphabet[a >>> 2]! + alphabet[((a & 3) << 4) | ((b ?? 0) >>> 4)]!
      + (b === undefined ? '=' : alphabet[((b & 15) << 2) | ((c ?? 0) >>> 6)]!)
      + (c === undefined ? '=' : alphabet[c & 63]!);
    if (chunk.length >= 16384) {chunks.push(chunk); chunk = '';}
  }
  if (chunk) chunks.push(chunk); return chunks.join('');
}
export function decodeBase64(text: string): Uint8Array {
  if (text.length % 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) throw new TypeError('Invalid native base64 byte transport.');
  const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0, bytes = new Uint8Array(text.length / 4 * 3 - padding);
  let out = 0;
  for (let index = 0; index < text.length; index += 4) {
    const a = alphabet.indexOf(text[index]!), b = alphabet.indexOf(text[index + 1]!);
    const c = text[index + 2] === '=' ? 0 : alphabet.indexOf(text[index + 2]!), d = text[index + 3] === '=' ? 0 : alphabet.indexOf(text[index + 3]!);
    if (out < bytes.length) bytes[out++] = (a << 2) | (b >>> 4);
    if (out < bytes.length) bytes[out++] = ((b & 15) << 4) | (c >>> 2);
    if (out < bytes.length) bytes[out++] = ((c & 3) << 6) | d;
  }
  return bytes;
}
