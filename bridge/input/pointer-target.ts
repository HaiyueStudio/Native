export interface LogicalRect { x: number; y: number; width: number; height: number }
export interface TouchPoint { id: number; x: number; y: number }
export type TouchAction = 'down' | 'move' | 'up' | 'cancel';
export interface OrbitPointer {
  pointerId: number; pointerType: 'touch'; button: 0;
  clientX: number; clientY: number; defaultPrevented: boolean;
  preventDefault(): void;
}
type Listener = (event: OrbitPointer) => void;

/** A single-pointer event target. Coordinates and bounds are both UIKit points. */
export class OrbitPointerTarget {
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly touches = new Map<number, TouchPoint>();
  private primary: number | null = null;
  private captured: number | null = null;
  private paused = false;
  private disposed = false;

  constructor(private readonly rect: () => LogicalRect, private readonly mode: 'primary' | 'all' = 'primary') {}

  getBoundingClientRect() {
    const r = this.rect();
    return { ...r, left: r.x, top: r.y, right: r.x + r.width, bottom: r.y + r.height };
  }

  addEventListener(type: string, listener: Listener): void {
    if (this.disposed) return;
    let entries = this.listeners.get(type);
    if (!entries) this.listeners.set(type, entries = new Set());
    entries.add(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  setPointerCapture(id: number): void {
    if ((this.mode === 'primary' && id !== this.primary) || !this.touches.has(id)) throw new Error('Cannot capture an inactive native touch.');
    // UIKit's recognizer owns this UITouch through end/cancel even outside its view.
    this.captured = id;
  }

  releasePointerCapture(id: number): void {
    if (this.captured === id) this.captured = null;
  }

  handle(action: TouchAction, points: readonly TouchPoint[]): void {
    if (this.disposed || this.paused) return;
    for (const point of points) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      if (action === 'down') {
        if (this.touches.has(point.id)) continue;
        this.touches.set(point.id, point);
        if (this.primary !== null && this.mode === 'primary') continue;
        if (this.primary === null) this.primary = point.id;
        this.emit('pointerdown', point);
      } else {
        if (!this.touches.has(point.id)) continue;
        this.touches.set(point.id, point);
        if (this.mode === 'all' || point.id === this.primary) this.emit(`pointer${action}`, point);
        if (action === 'up' || action === 'cancel') {
          this.touches.delete(point.id);
          if (point.id === this.primary) { this.primary = null; this.captured = null; }
        }
      }
    }
  }

  cancel(): void {
    const point = this.primary === null ? undefined : this.touches.get(this.primary);
    if (this.mode === 'all') { for (const touch of this.touches.values()) this.emit('pointercancel', touch); }
    else if (point) this.emit('pointercancel', point);
    this.touches.clear();
    this.primary = null;
    this.captured = null;
  }

  suspend(): void { this.cancel(); this.paused = true; }
  resume(): void { if (!this.disposed) this.paused = false; }
  dispose(): void {
    if (this.disposed) return;
    this.suspend();
    this.listeners.clear();
    this.disposed = true;
  }

  snapshot() {
    return { primary: this.primary, captured: this.captured, trackedTouches: this.touches.size,
      listenerCount: [...this.listeners.values()].reduce((sum, entries) => sum + entries.size, 0),
      paused: this.paused, disposed: this.disposed };
  }

  private emit(type: string, point: TouchPoint): void {
    const rect = this.rect();
    const event: OrbitPointer = {
      pointerId: point.id, pointerType: 'touch', button: 0,
      clientX: rect.x + point.x, clientY: rect.y + point.y,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
    };
    // Native view input has no DOM wheel/scroll default. Canvas's own pointer
    // synthesis is disabled by the native adapter, and system cancellation wins.
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}
