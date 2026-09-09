import type { Canvas } from '@nativescript/canvas';
import { GesturesObserver, GestureTypes, type TouchGestureEventData } from '@nativescript/core/ui/gestures';
import { OrbitPointerTarget, type TouchAction } from './pointer-target';
import { TouchIdentity } from './touch-identity';

export interface NativeTouchSample {
  action: TouchAction | 'suspend' | 'unloaded' | 'dispose';
  points: { id: number; x: number; y: number; nativeHash: number }[];
  input: ReturnType<OrbitPointerTarget['snapshot']>;
}

export class NativeTouchInput {
  readonly target: OrbitPointerTarget;
  private readonly identity = new TouchIdentity<UITouch>((a, b) => a === b || a.isEqual(b));
  private readonly observer: GesturesObserver;
  private readonly previousMultipleTouch: boolean;
  private disposed = false;
  private paused = false;

  constructor(private readonly view: Canvas, private readonly sample: (event: NativeTouchSample) => void) {
    if (!view.ignoreTouchEvents) throw new Error('Disable Canvas pointer synthesis before attaching Core touch.');
    const native = view.nativeViewProtected as UIView;
    this.previousMultipleTouch = native.multipleTouchEnabled;
    native.multipleTouchEnabled = true;
    this.target = new OrbitPointerTarget(() => {
      const position = view.getLocationInWindow();
      return { x: position?.x ?? 0, y: position?.y ?? 0, width: view.clientWidth, height: view.clientHeight };
    });
    this.observer = new GesturesObserver(view, event => this.touch(event as TouchGestureEventData), this);
    this.observer.observe(GestureTypes.touch);
    view.on('unloaded', this.unloaded);
  }

  snapshot() { return { ...this.target.snapshot(), nativeIdentities: this.identity.count, nativeObserverCount: this.disposed ? 0 : 1, nativeRecognizerCount: (this.view.nativeViewProtected as UIView | undefined)?.gestureRecognizers?.count ?? 0 }; }

  private touch(event: TouchGestureEventData): void {
    if (this.disposed || this.paused) return;
    const action = event.action as TouchAction;
    if (!['down', 'move', 'up', 'cancel'].includes(action)) return;
    const pointers = event.getActivePointers();
    // NSSet iteration has no chronology; earliest timestamp wins simultaneous downs.
    if (action === 'down') pointers.sort((a, b) => (a.ios as UITouch).timestamp - (b.ios as UITouch).timestamp);
    const points: NativeTouchSample['points'] = [];
    for (const pointer of pointers) {
      const touch = pointer.ios as UITouch;
      const id = action === 'down' ? this.identity.begin(touch) : this.identity.find(touch);
      if (id === undefined) continue;
      points.push({ id, x: pointer.getX(), y: pointer.getY(), nativeHash: touch.hash });
    }
    this.target.handle(action, points);
    if (action === 'up' || action === 'cancel') for (const point of points) this.identity.end(point.id);
    this.sample({ action, points, input: this.target.snapshot() });
  }

  private cancel(action: 'suspend' | 'unloaded' | 'dispose'): void {
    this.target.suspend();
    this.identity.clear();
    this.paused = true;
    this.sample({ action, points: [], input: this.target.snapshot() });
  }

  private readonly unloaded = (): void => this.cancel('unloaded');
  suspend(): void { if (!this.disposed) this.cancel('suspend'); }
  resume(): void { if (!this.disposed) { this.paused = false; this.target.resume(); } }
  dispose(): void {
    if (this.disposed) return;
    this.cancel('dispose');
    this.observer.disconnect();
    this.view.off('unloaded', this.unloaded);
    const native = this.view.nativeViewProtected as UIView | undefined;
    if (native) native.multipleTouchEnabled = this.previousMultipleTouch;
    this.target.dispose();
    this.disposed = true;
  }
}
