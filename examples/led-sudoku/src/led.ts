import { AbsoluteLayout, Color, StackLayout } from '@nativescript/core';
/** Lightweight native views for seven-segment HUD digits; no extra GPU canvases. */
export class LedDigit {
  readonly view = new AbsoluteLayout();
  private readonly segments: StackLayout[] = [];
  constructor(scale = 1) {
    this.view.width = 30 * scale; this.view.height = 44 * scale; this.view.isUserInteractionEnabled = false;
    for (const [x, y, w, h] of [[6, 1, 18, 4], [24, 5, 4, 15], [24, 24, 4, 15], [6, 39, 18, 4], [2, 24, 4, 15], [2, 5, 4, 15], [6, 20, 18, 4]]) {
      const segment = new StackLayout(); segment.width = w * scale; segment.height = h * scale; segment.borderRadius = 2 * scale;
      AbsoluteLayout.setLeft(segment, x * scale); AbsoluteLayout.setTop(segment, y * scale); this.view.addChild(segment); this.segments.push(segment);
    }
  }
  set(mask: number, color = '#83ffc1', enabled = true): void { this.segments.forEach((s, i) => { s.backgroundColor = new Color(mask & (1 << i) ? color : '#162b33'); }); this.view.opacity = enabled ? 1 : .23; }
}
