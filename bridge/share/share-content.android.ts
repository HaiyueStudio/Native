import { Application } from '@nativescript/core';
import { validateShare, ShareError, shareFailure, type ShareContent, type ShareResult } from './types';
export { ShareError } from './types';
export type { ShareContent, ShareImage, ShareResult, ShareErrorCode } from './types';
let busy = false, sequence = 0, requestCode = 0x6b00;
export function canShareContent(content: ShareContent): boolean {
  try {
    const value = validateShare(content), activity = Application.android.foregroundActivity;
    if (!activity) return false;
    return !value.image || !!activity.getPackageManager().resolveContentProvider(`${activity.getPackageName()}.haiyue.share`, 0);
  } catch { return false; }
}
export async function shareContent(content: ShareContent): Promise<ShareResult> {
  if (busy) throw new ShareError('busy', 'A system share is already active');
  const value = validateShare(content), activity = Application.android.foregroundActivity;
  if (!activity || activity.isFinishing()) throw new ShareError('unavailable', 'No foreground activity for sharing');
  busy = true;
  let pendingFolder: java.io.File | undefined;
  let launched = false;
  try {
    const intent = new android.content.Intent(android.content.Intent.ACTION_SEND);
    intent.setType(value.image?.mimeType ?? 'text/plain');
    if (value.title) intent.putExtra(android.content.Intent.EXTRA_SUBJECT, value.title);
    const text = [value.text, value.url].filter(Boolean).join('\n');
    if (text) intent.putExtra(android.content.Intent.EXTRA_TEXT, text);
    if (value.image) {
      if (!activity.getPackageManager().resolveContentProvider(`${activity.getPackageName()}.haiyue.share`, 0))
        throw new ShareError('unavailable', 'Configure the Haiyue share FileProvider before sharing images');
      const root = new java.io.File(activity.getCacheDir(), 'haiyue-share');
      if (!root.exists() && !root.mkdirs()) throw new Error('Cannot create share cache');
      // Do not delete at chooser completion: the receiving app may read later.
      const old = root.listFiles();
      if (old) for (let i = 0; i < old.length; i++) {
        const entry = old[i];
        if (!/^share-\d+-\d+$/.test(String(entry.getName())) || Date.now() - entry.lastModified() < 86400000) continue;
        const files = entry.listFiles();
        if (files) for (let j = 0; j < files.length; j++) files[j].delete();
        entry.delete();
      }
      pendingFolder = new java.io.File(root, `share-${Date.now()}-${++sequence}`);
      if (!pendingFolder.mkdirs()) throw new Error('Cannot create share request cache');
      const file = new java.io.File(pendingFolder, value.image.filename!);
      const bytes = Array.create('byte', value.image.bytes.byteLength);
      for (let i = 0; i < bytes.length; i++) bytes[i] = (value.image.bytes[i] << 24) >> 24;
      const stream = new java.io.FileOutputStream(file);
      try { stream.write(bytes); } finally { stream.close(); }
      const uri = androidx.core.content.FileProvider.getUriForFile(activity, `${activity.getPackageName()}.haiyue.share`, file);
      intent.putExtra(android.content.Intent.EXTRA_STREAM, uri);
      intent.setClipData(android.content.ClipData.newRawUri(value.image.filename!, uri));
      intent.addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
    }
    const chooser = android.content.Intent.createChooser(intent, value.title ?? '');
    if (value.image) chooser.addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
    const code = requestCode = requestCode >= 0x6bff ? 0x6b01 : requestCode + 1;
    return await new Promise<ShareResult>((resolve, reject) => {
      const finish = (error?: unknown) => {
        Application.android.off(Application.android.activityResultEvent, result);
        Application.off(Application.exitEvent, exit);
        error ? reject(shareFailure(error)) : resolve({ status: 'presented' });
      };
      const result = (args: { requestCode: number }) => { if (args.requestCode === code) finish(); };
      const exit = () => finish(new ShareError('unavailable', 'Share host exited'));
      Application.android.on(Application.android.activityResultEvent, result);
      Application.on(Application.exitEvent, exit);
      try { activity.startActivityForResult(chooser, code); launched = true; } catch (error) { finish(error); }
    });
  } catch (error) { throw shareFailure(error); }
  finally {
    if (!launched && pendingFolder) {
      const files = pendingFolder.listFiles();
      if (files) for (let i = 0; i < files.length; i++) files[i].delete();
      pendingFolder.delete();
    }
    busy = false;
  }
}
