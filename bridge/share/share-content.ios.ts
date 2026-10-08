import { Application, Utils, File, knownFolders, Folder } from '@nativescript/core';
import { validateShare, ShareError, shareFailure, type ShareContent, type ShareResult } from './types';
export { ShareError } from './types';
export type { ShareContent, ShareImage, ShareResult, ShareErrorCode } from './types';
let busy = false;
let sequence = 0;
export function canShareContent(content: ShareContent): boolean {
  try { validateShare(content); return !!Application.ios.rootController; } catch { return false; }
}
export async function shareContent(content: ShareContent): Promise<ShareResult> {
  if (busy) throw new ShareError('busy', 'A system share is already active');
  const value = validateShare(content);
  busy = true;
  try {
    return await new Promise<ShareResult>((resolve, reject) => Utils.executeOnMainThread(() => {
      let folder: Folder | undefined;
      let finished = false;
      const finish = (result: ShareResult, error?: unknown) => {
        if (finished) return;
        finished = true;
        // File consumers have completed before the activity completion callback.
        if (folder) void folder.remove().catch(() => {});
        error ? reject(shareFailure(error)) : resolve(result);
      };
      try {
        let host = Application.ios.rootController;
        while (host?.presentedViewController) host = host.presentedViewController;
        if (!host?.view?.window || host.beingDismissed || host.beingPresented) throw new ShareError('unavailable', 'No foreground view for sharing');
        const items: unknown[] = [];
        if (value.text) items.push(value.text);
        if (value.url) {
          const url = NSURL.URLWithString(value.url);
          if (!url) throw new ShareError('invalid-data', 'Invalid share URL');
          items.push(url);
        }
        if (value.image) {
          const bytes = value.image.bytes;
          const encoded = NSData.dataWithBytesLength(interop.handleof(bytes.buffer), bytes.byteLength);
          if (!UIImage.imageWithData(encoded)) throw new ShareError('invalid-data', 'Cannot decode share image');
          folder = Folder.fromPath(`${knownFolders.temp().path}/haiyue-share-${Date.now()}-${++sequence}`);
          const file = File.fromPath(`${folder.path}/${value.image.filename!}`);
          file.writeSync(encoded);
          items.push(NSURL.fileURLWithPath(file.path));
        }
        const controller = UIActivityViewController.alloc().initWithActivityItemsApplicationActivities(items, []);
        if (value.title) controller.setValueForKey(value.title, 'subject');
        controller.completionWithItemsHandler = (_activity, completed, _items, error) => finish(
          { status: completed ? 'completed' : 'cancelled' }, error ? new Error(error.localizedDescription) : undefined);
        // A popover anchor is mandatory on iPad, including landscape and split view.
        const popover = controller.popoverPresentationController;
        if (popover) {
          popover.sourceView = host.view;
          popover.sourceRect = CGRectMake(host.view.bounds.size.width / 2, host.view.bounds.size.height / 2, 1, 1);
          popover.permittedArrowDirections = 0 as UIPopoverArrowDirection;
        }
        host.presentViewControllerAnimatedCompletion(controller, true, () => {});
      } catch (error) { finish({ status: 'cancelled' }, error); }
    }));
  } finally { busy = false; }
}
