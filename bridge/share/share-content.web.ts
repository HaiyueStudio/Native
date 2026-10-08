import { validateShare, ShareError, shareFailure, type ShareContent, type ShareResult } from './types';
export { ShareError } from './types';
export type { ShareContent, ShareImage, ShareResult, ShareErrorCode } from './types';
let busy = false;
function data(content: ShareContent): ShareData {
  const value = validateShare(content);
  const result: ShareData = { title: value.title, text: value.text, url: value.url };
  if (value.image) result.files = [new File([new Uint8Array(value.image.bytes)], value.image.filename!, { type: value.image.mimeType })];
  return result;
}
function supported(value: ShareData): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare === 'function') return navigator.canShare(value);
  return !value.files; // Never silently discard unsupported images.
}
export function canShareContent(content: ShareContent): boolean {
  try { return supported(data(content)); } catch { return false; }
}
/** Call directly in a tap/click handler; do not await screenshot/network work first. */
export async function shareContent(content: ShareContent): Promise<ShareResult> {
  if (busy) throw new ShareError('busy', 'A system share is already active');
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    validateShare(content);
    return { status: 'unsupported' };
  }
  const value = data(content);
  if (!supported(value)) return { status: 'unsupported' };
  busy = true;
  try {
    // No asynchronous step before this call: preserve transient user activation.
    await navigator.share(value);
    return { status: 'completed' };
  } catch (error) {
    // Browsers also use AbortError when there are no available share targets.
    if ((error as { name?: string })?.name === 'AbortError') return { status: 'cancelled' };
    throw shareFailure(error);
  } finally { busy = false; }
}
