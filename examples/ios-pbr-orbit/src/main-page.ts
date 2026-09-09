import { Application, EventData, Label, Page } from '@nativescript/core';
import type { Canvas } from '@nativescript/canvas';
import { NativeRenderHost } from '../../../bridge/lifecycle/host';
import { preparePbrScene } from './pbr-scene';
import { bindOrbit } from './orbit-session';

let host: NativeRenderHost | null = null;
let activeCanvas: Canvas | null = null;
const readyCanvases = new WeakSet<Canvas>();
function unhandled(args: { error?: unknown }): void { host?.fail(args.error); }

export function onCanvasReady(args: EventData): void {
  const canvas = args.object as Canvas;
  readyCanvases.add(canvas);
  ensureHost(canvas);
}

export function onLoaded(args: EventData): void {
  const canvas = (args.object as Page).getViewById<Canvas>('surface');
  if (canvas && readyCanvases.has(canvas)) ensureHost(canvas);
}

function ensureHost(canvas: Canvas): void {
  if (host && activeCanvas !== canvas) disposeHost();
  const page = canvas.page as Page;
  const update = (text: string) => {
    const label = page.getViewById<Label>('status');
    if (label) label.text = text;
  };
  if (host) return;
  try {
    const environment = NSProcessInfo.processInfo.environment;
    const variant = String(environment.objectForKey('G03_ROUGHNESS'));
    // Diagnostics are launch-only; normal offline launches always use 0.28.
    const roughness = variant === '0.15' ? 0.15 : variant === '0.75' ? 0.75 : 0.28;
    activeCanvas = canvas;
    host = new NativeRenderHost(canvas, update, {
      prepareScene: engine => preparePbrScene(engine, roughness),
      bindInput: (engine, report) => bindOrbit(engine, canvas, report),
      diagnosticName: 'g04',
      capture: { requested: String(environment.objectForKey('G04_CAPTURE_FRAME')) === '1', file: 'g04-orbit.png' },
    });
    Application.on(Application.uncaughtErrorEvent, unhandled);
    Application.on(Application.exitEvent, disposeHost);
  } catch (error) {
    update(`原生宿主初始化失败\n${String(error)}`);
    console.error('[G04] host construction failed', error);
  }
}

export function onUnloaded(): void {
  // iOS also unloads the root view while backgrounding. Keep the stopped host
  // and its resume listener; Canvas.ready is only emitted once for this view.
  if (Application.inBackground || Application.suspended) return;
  disposeHost();
}

function disposeHost(): void {
  Application.off(Application.uncaughtErrorEvent, unhandled);
  Application.off(Application.exitEvent, disposeHost);
  host?.dispose();
  host = null;
  activeCanvas = null;
}
