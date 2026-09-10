/** GUI drains its pointer queue during rendering, sometimes after the UITouch ended.
 * UIKit already retains each active touch through end/cancel; a stale capture is a no-op.
 */
export function captureNativePointer(target: { setPointerCapture(id: number): void }, id: number): void {
  try { target.setPointerCapture(id); }
  catch (error) {
    if (!(error instanceof Error) || error.message !== 'Cannot capture an inactive native touch.') throw error;
  }
}
