import { HY_ICONS } from '@haiyue/ui/portable';
import type { HYIconName } from '@haiyue/ui/core';
import { Color } from '@nativescript/core';
import { ImageSource, type View } from '@nativescript/core';
import type { HYNativeTextHandle, HYTextObservation } from './types';
import { createNativeCallback } from './native-callback';

export function assertMainThread(): void {
  if (!NSThread.isMainThread) throw new Error('Native UI commits must run on the main thread');
}
export function isAccessibilityInteraction(): boolean { return UIAccessibilityIsVoiceOverRunning(); }
export function focusNative(view: View): void {
  view.focus();
  const native = view.ios instanceof UIViewController ? view.ios.view : view.ios;
  if (UIAccessibilityIsVoiceOverRunning() && native) UIAccessibilityPostNotification(UIAccessibilityLayoutChangedNotification, native);
}
export function setClipping(view: View, clip: boolean): void {
  const native = view.ios instanceof UIViewController ? view.ios.view : view.ios;
  if (native) native.clipsToBounds = clip;
}
export function systemIcon(name: string): ImageSource | undefined {
  const image = UIImage.systemImageNamed(name); return image ? new ImageSource(image) : undefined;
}
export function observeText(view: View, changed: (state: HYTextObservation) => void, dismissLabel = 'Done'): HYNativeTextHandle {
  const input = view.ios as UITextField | UITextView;
  const center = NSNotificationCenter.defaultCenter;
  let disposed = false, writing = false;
  // A visible text button works for multiline/secure inputs and keyboards
  // without Return. Do not rely on UIBarButtonItem's OS-specific Done rendering.
  const previousAccessory = input.inputAccessoryView;
  const width = input.window?.bounds.size.width || UIScreen.mainScreen.bounds.size.width;
  const toolbar = UIView.alloc().initWithFrame(CGRectMake(0, 0, width, 52));
  toolbar.autoresizingMask = UIViewAutoresizing.FlexibleWidth;
  // Leave the keyboard's rounded silhouette visible. Only the action has a
  // material background; an opaque accessory would add a full-width strip.
  toolbar.backgroundColor = UIColor.clearColor;
  toolbar.opaque = false;
  const material = UIVisualEffectView.alloc().initWithEffect(UIBlurEffect.effectWithStyle(UIBlurEffectStyle.SystemMaterial));
  material.frame = CGRectMake(width - 108, 4, 96, 44);
  material.autoresizingMask = UIViewAutoresizing.FlexibleLeftMargin;
  material.layer.cornerRadius = 22;
  material.clipsToBounds = true;
  material.userInteractionEnabled = false;
  material.isAccessibilityElement = false;
  toolbar.addSubview(material);
  const done = UIButton.buttonWithType(UIButtonType.System);
  done.frame = CGRectMake(width - 108, 4, 96, 44);
  done.autoresizingMask = UIViewAutoresizing.FlexibleLeftMargin;
  done.setTitleForState(dismissLabel, UIControlState.Normal);
  done.titleLabel.font = UIFont.systemFontOfSizeWeight(17, UIFontWeightSemibold);
  done.tintColor = UIColor.systemBlueColor;
  done.accessibilityIdentifier = 'haiyue.keyboard.done';
  done.accessibilityLabel = dismissLabel;
  const dismissCallback = createNativeCallback(() => {
    if (!disposed) input.resignFirstResponder();
  });
  const action = UIAction.actionWithTitleImageIdentifierHandler(dismissLabel, null!, 'haiyue.keyboard.dismiss', dismissCallback.invoke);
  done.addActionForControlEvents(action, UIControlEvents.TouchUpInside);
  toolbar.addSubview(done);
  input.inputAccessoryView = toolbar;
  if (input.isFirstResponder) input.reloadInputViews();
  const read = (): HYTextObservation => ({value: String(input.text ?? ''), composing: !!input.markedTextRange});
  // Observe after UIKit edits; NativeScript TextField.textChange can run BEFORE marked text is installed.
  const name = input instanceof UITextView ? UITextViewTextDidChangeNotification : UITextFieldTextDidChangeNotification;
  const textCallback = createNativeCallback(() => {
    if (!disposed && !writing) changed(read());
  });
  const token = center.addObserverForNameObjectQueueUsingBlock(name, input, NSOperationQueue.mainQueue, textCallback.invoke);
  return {read, write(value) {
    if (disposed || value === String(input.text ?? '')) return;
    const selection = input.selectedTextRange;
    const start = selection ? input.offsetFromPositionToPosition(input.beginningOfDocument, selection.start) : value.length;
    const end = selection ? input.offsetFromPositionToPosition(input.beginningOfDocument, selection.end) : start;
    writing = true;
    try {
      // The public NativeScript property keeps its binding cache coherent. No private delegate/field mutation.
      (view as View & {text: string}).text = value;
      const a = input.positionFromPositionOffset(input.beginningOfDocument, Math.min(start, value.length));
      const b = input.positionFromPositionOffset(input.beginningOfDocument, Math.min(end, value.length));
      if (a && b) input.selectedTextRange = input.textRangeFromPositionToPosition(a, b);
    } finally { writing = false; }
  }, dispose() {
    if (!disposed) {
      disposed = true;
      dismissCallback.dispose();
      textCallback.dispose();
      center.removeObserver(token);
      if (input.inputAccessoryView === toolbar) {
        input.inputAccessoryView = previousAccessory;
        if (input.isFirstResponder) input.reloadInputViews();
      }
      // Release the action block as well as the view when a node is unloaded.
      done.removeActionForControlEvents(action, UIControlEvents.TouchUpInside);
      done.removeFromSuperview();
      material.removeFromSuperview();
    }
  }};
}
export function observeKeyboard(view: View, changed: (height: number) => void): () => void {
  const center = NSNotificationCenter.defaultCenter;
  const callback = createNativeCallback((notification: NSNotification) => {
    const native = view.ios as UIView;
    if (!native?.window) return;
    const frame = (notification.userInfo.objectForKey(UIKeyboardFrameEndUserInfoKey) as NSValue).CGRectValue;
    const bounds = native.convertRectToView(native.bounds, null!);
    // Ignore floating/split keyboards; UIScrollView retains native caret scrolling there.
    const overlapX = Math.min(bounds.origin.x + bounds.size.width, frame.origin.x + frame.size.width) - Math.max(bounds.origin.x, frame.origin.x);
    const overlap = overlapX >= bounds.size.width - 1 ? Math.max(0, bounds.origin.y + bounds.size.height - frame.origin.y) : 0;
    changed(Math.min(bounds.size.height, overlap));
  });
  const token = center.addObserverForNameObjectQueueUsingBlock(UIKeyboardWillChangeFrameNotification, null, NSOperationQueue.mainQueue, callback.invoke);
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    callback.dispose();
    center.removeObserver(token);
  };
}

/** Keep the presenting page visible beneath the portable dialog backdrop. */
export function modalPresentationOptions(): Partial<import('@nativescript/core').ShowModalOptions> { return {ios:{presentationStyle:UIModalPresentationStyle.OverFullScreen}}; }

/** UIKit owns animation timing; no JS interval and no font glyph substitution. */
export function buttonAdornment(view: View, icon: HYIconName | undefined, busy: boolean, color: string): () => void {
  const button = view.ios as UIButton;
  if (!button) return () => {};
  button.semanticContentAttribute=icon==='chevronDown'?UISemanticContentAttribute.ForceRightToLeft:UISemanticContentAttribute.Unspecified;
  let spinner: UIActivityIndicatorView | undefined;
  if (busy) {
    spinner = UIActivityIndicatorView.alloc().initWithActivityIndicatorStyle(UIActivityIndicatorViewStyle.Medium);
    spinner.color = new Color(color).ios;
    const size = button.bounds.size;
    spinner.frame = CGRectMake((view as View & {text:string}).text ? 8 : (size.width - 20) / 2, (size.height - 20) / 2, 20, 20);
    spinner.autoresizingMask = UIViewAutoresizing.FlexibleLeftMargin | UIViewAutoresizing.FlexibleRightMargin | UIViewAutoresizing.FlexibleTopMargin | UIViewAutoresizing.FlexibleBottomMargin;
    spinner.userInteractionEnabled = false;button.addSubview(spinner);spinner.startAnimating();
    button.setImageForState(null!, UIControlState.Normal);
  } else if (icon) {
    UIGraphicsBeginImageContextWithOptions(CGSizeMake(20, 20), false, 0);
    try {
      new Color(color).ios.setStroke();
      for (const points of HY_ICONS[icon]) {
        const path = UIBezierPath.bezierPath();path.lineWidth = 1.5;path.lineCapStyle = CGLineCap.kCGLineCapRound;path.lineJoinStyle = CGLineJoin.kCGLineJoinRound;
        points.forEach(([x,y],index) => index ? path.addLineToPoint(CGPointMake(x*20/24,y*20/24)) : path.moveToPoint(CGPointMake(x*20/24,y*20/24)));
        path.stroke();
      }
      button.setImageForState(UIGraphicsGetImageFromCurrentImageContext()?.imageWithRenderingMode(UIImageRenderingMode.AlwaysOriginal) ?? null!, UIControlState.Normal);
    } finally { UIGraphicsEndImageContext(); }
  } else button.setImageForState(null!, UIControlState.Normal);
  return () => { spinner?.stopAnimating();spinner?.removeFromSuperview();button.setImageForState(null!, UIControlState.Normal); };
}
