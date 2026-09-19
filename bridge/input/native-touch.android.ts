import { Screen } from '@nativescript/core';
import { GesturesObserver, GestureTypes, type TouchGestureEventData } from '@nativescript/core/ui/gestures';
import type { Canvas } from '@nativescript/canvas';
import { nativeViewRect } from '../render/view-rect.android';
import { OrbitPointerTarget, type TouchAction } from './pointer-target';
export interface NativeTouchSample {
  action: TouchAction | 'suspend' | 'unloaded' | 'dispose';
  points: { id: number; x: number; y: number; nativeHash: number }[];
  input: ReturnType<OrbitPointerTarget['snapshot']>;
}
export class NativeTouchInput {
  readonly target: OrbitPointerTarget;
  readonly orbitTarget: OrbitPointerTarget | null;
  private readonly observer: GesturesObserver;
  private readonly ids = new Set<number>();
  private pinching = false;
  private disposed = false;
  private paused = false;
  get isPinching(): boolean { return this.pinching; }
  constructor(private readonly view: Canvas, private readonly sample: (event: NativeTouchSample) => void, options: { pinchZoom?: boolean } = {}) {
    if (!view.ignoreTouchEvents) throw new Error('Disable Canvas pointer synthesis before attaching Core touch.');
    this.target = new OrbitPointerTarget(() => nativeViewRect(view));
    this.orbitTarget = options.pinchZoom ? new OrbitPointerTarget(() => nativeViewRect(view), 'all') : null;
    this.observer = new GesturesObserver(view, event => this.touch(event as TouchGestureEventData), this);
    this.observer.observe(GestureTypes.touch); view.on('unloaded', this.unloaded);
  }
  snapshot() { return { pinching: this.pinching, rect: nativeViewRect(this.view), measured: { width: this.view.clientWidth, height: this.view.clientHeight }, ...this.target.snapshot(), nativeIdentities: this.ids.size, nativeObserverCount: this.disposed ? 0 : 1, nativeRecognizerCount: this.disposed ? 0 : 1 }; }
  private touch(event: TouchGestureEventData): void {
    if (this.disposed || this.paused) return;
    const action = event.action as TouchAction, motion = event.android as android.view.MotionEvent;
    if (!['down','move','up','cancel'].includes(action)) return;
    const indices = action === 'move' || action === 'cancel' ? Array.from({length:motion.getPointerCount()},(_,i)=>i) : [motion.getActionIndex()];
    const points = indices.map(i => ({ id: motion.getPointerId(i), nativeHash: motion.getPointerId(i), x: motion.getX(i) / Screen.mainScreen.scale, y: motion.getY(i) / Screen.mainScreen.scale }));
    if (action === 'down') for (const point of points) this.ids.add(point.id);
    if (this.orbitTarget && !this.pinching && this.ids.size >= 2) { this.pinching = true; this.target.suspend(); }
    this.target.handle(action, points); this.orbitTarget?.handle(action, points);
    if (action === 'up' || action === 'cancel') for (const point of points) this.ids.delete(point.id);
    this.sample({ action, points, input: this.target.snapshot() });
    if (this.pinching && this.ids.size !== 2) this.orbitTarget?.suspend();
    if (this.pinching && !this.ids.size) { this.pinching = false; this.target.resume(); this.orbitTarget?.resume(); }
  }
  private cancel(action: 'suspend' | 'unloaded' | 'dispose'): void {
    this.target.suspend(); this.orbitTarget?.suspend(); this.ids.clear(); this.pinching = false; this.paused = true;
    this.sample({ action, points: [], input: this.target.snapshot() });
  }
  private readonly unloaded = (): void => this.cancel('unloaded');
  suspend(): void { if (!this.disposed) this.cancel('suspend'); }
  resume(): void { if (!this.disposed) { this.paused = false; this.target.resume(); this.orbitTarget?.resume(); } }
  dispose(): void { if (this.disposed) return; this.cancel('dispose'); this.observer.disconnect(); this.view.off('unloaded',this.unloaded); this.target.dispose(); this.orbitTarget?.dispose(); this.disposed=true; }
}
