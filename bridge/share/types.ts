/** Encoded PNG/JPEG bytes, not raw GPU pixels. Prepare before the user's share tap. */
export interface ShareImage {
  bytes: Uint8Array;
  mimeType: 'image/png' | 'image/jpeg';
  filename?: string;
}
export interface ShareContent {
  title?: string;
  text?: string;
  /** Absolute HTTP(S) link. Receiving apps may ignore accompanying text or links. */
  url?: string;
  image?: ShareImage;
}
/** Never proves a social post was published. Android cannot reliably report cancellation. */
export interface ShareResult { status: 'completed' | 'cancelled' | 'presented' | 'unsupported'; }
export type ShareErrorCode = 'invalid-data' | 'busy' | 'unavailable' | 'failed';
export class ShareError extends Error {
  constructor(readonly code: ShareErrorCode, message: string) { super(message); this.name = 'ShareError'; }
}

export function validateShare(content: ShareContent): ShareContent {
  const bad = (message: string): never => { throw new ShareError('invalid-data', message); };
  if (!content || typeof content !== 'object') bad('Expected share content');
  const result: ShareContent = {};
  for (const key of ['title', 'text', 'url'] as const) {
    const value = content[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.length > 16384 || value.includes('\0')) bad(`Invalid share ${key}`);
    if (value.trim()) result[key] = value;
  }
  if (result.url && !/^https?:\/\/[^\s/?#]+(?:[/?#][^\s]*)?$/i.test(result.url)) bad('Share URL must be an absolute HTTP(S) URL');
  if (content.image !== undefined) {
    const { bytes, mimeType, filename } = content.image ?? {};
    if (!ArrayBuffer.isView(bytes) || Object.prototype.toString.call(bytes) !== '[object Uint8Array]'
      || bytes.byteLength === 0 || bytes.byteLength > 10 * 1024 * 1024) bad('Share image must contain 1 byte to 10 MiB of encoded data');
    if (mimeType !== 'image/png' && mimeType !== 'image/jpeg') bad('Only PNG and JPEG sharing is supported');
    const png = [137, 80, 78, 71, 13, 10, 26, 10];
    if (mimeType === 'image/png' ? !png.every((byte, i) => bytes[i] === byte) : !(bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)) bad('Image signature does not match MIME type');
    const name = filename ?? (mimeType === 'image/png' ? 'result.png' : 'result.jpg');
    if (typeof name !== 'string' || name.length > 120 || /[\x00-\x1f\x7f/\\:]/.test(name)
      || !(mimeType === 'image/png' ? /\.png$/i : /\.jpe?g$/i).test(name)) bad('Invalid image filename');
    result.image = { bytes: new Uint8Array(bytes), mimeType, filename: name };
  }
  if (!result.text && !result.url && !result.image) bad('Share content requires text, URL or image');
  return result;
}
export function shareFailure(error: unknown): ShareError {
  return error instanceof ShareError ? error : new ShareError('failed', error instanceof Error ? error.message : String(error));
}
