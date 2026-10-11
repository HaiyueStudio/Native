import { dirname, join } from 'node:path';
import { installWebGpuCompatibility } from '../host/webgpu-compat';
import { createCanvas, ImageData, GlobalFonts } from '@napi-rs/canvas';
import { runDesktopProbes } from '../host/probes';
import { HaiyueEngine } from '@haiyue/engine';
import { LocalStorageSaveBackend } from '@haiyue/engine/save';
import { CubeGame } from '../../games/rubiks-cube/CubeGame';
import { GlfwWindow } from '../host/glfw';
import { DesktopStorage, applicationDataDirectory } from '../host/storage';

const assets = join(dirname(Deno.execPath()), 'assets');
const options = Object.fromEntries(Deno.args.map(value => { const i = value.indexOf('='); return i < 0 ? [value, '1'] : [value.slice(0, i), value.slice(i + 1)]; }));
options['--glfw'] ??= join(assets, Deno.build.os === 'windows' ? 'glfw3.dll' : 'libglfw.3.dylib');
options['--font'] ??= join(assets, 'NotoSansCJKsc-Regular.otf');
options['--audio'] ??= join(assets, Deno.build.os === 'windows' ? 'haiyue_audio.dll' : 'libhaiyue_audio.dylib');
if (!options['--glfw']) throw new Error('Pass --glfw=/absolute/path/to/GLFW library');
if (!options['--font'] || !GlobalFonts.registerFromPath(options['--font'], 'Haiyue CJK')) throw new Error('Pass --font=/path/to/NotoSansCJKsc-Regular.otf');
const restoreWebGpu = installWebGpuCompatibility();
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) throw new Error('No native WebGPU adapter');
const window = new GlfwWindow(options['--glfw'], { title: 'Haiyue · 原生魔方', width: 1100, height: 740 });
const originalRequestFrame = globalThis.requestAnimationFrame, originalCancelFrame = globalThis.cancelAnimationFrame;
const callbacks = new Map<number, FrameRequestCallback>(); let nextCallback = 1;
globalThis.requestAnimationFrame = callback => { const id = nextCallback++; callbacks.set(id, callback); return id; };
globalThis.cancelAnimationFrame = id => { callbacks.delete(id); };
const storage = new DesktopStorage(options['--data'] ?? applicationDataDirectory('rubiks-cube-desktop'));
const engine = new HaiyueEngine({ canvas: window.canvas, gpu: { requestAdapter: async () => adapter,
  getPreferredCanvasFormat: () => navigator.gpu.getPreferredCanvasFormat() },
  devicePixelRatio: () => window.scale, msaaSamples: 4, renderProfile: 'simple', timestampQuery: false,
  recoverDeviceLost: false, diagnostics: { enabled: true }, clearColor: { r: 0.022, g: 0.037, b: 0.063, a: 1 } });
let game: CubeGame | undefined;
const report = (kind: string, data: unknown) => console.log(JSON.stringify({ kind, data }));
let fatal: unknown = null, frames = 0;
try {
  await engine.init();
  if (options['--probes']) report('probes', await runDesktopProbes(engine.device, storage.directory, options['--audio']));
  engine.device.addEventListener('uncapturederror', event => { fatal = event.error; });
  engine.on('device-lost', event => { fatal = new Error(`Device lost: ${event.detail?.message}`); });
  game = new CubeGame(engine, {
    saveBackend: new LocalStorageSaveBackend({ namespace: 'haiyue-games', storage }),
    guiFont: { fontFamily: 'Haiyue CJK', canvasFactory: (width, height) => createCanvas(width, height) as any,
      readAtlasPixels: canvas => new Uint8Array(canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data) },
  });
  await game.init();
  window.on('blur', () => { game?.cancelInteraction(); void game?.flushSave().catch(error => { fatal = error; }); });
  window.on('keydown', event => {
    if (event.repeat) return;
    if (['2', '3', '4'].includes(event.key)) game!.start(event.key);
    else if (event.key === 'm') game!.start('mirror');
    else if (event.key === 'F11') window.toggleFullscreen();
    else if (event.key === 'Escape') game!.goHome();
    else if (event.key === ' ') game!.session.shuffle(Date.now() >>> 0);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') game!.session.turn({ axis: game!.axis, layer: game!.layer, direction: event.key === 'ArrowLeft' ? -1 : 1 });
  });
  let previousPad: number[] = [];
  window.on('gamepad', event => {
    if (event.buttons[0] && !previousPad[0]) game!.session.turn({ axis: game!.axis, layer: game!.layer, direction: 1 });
    if (event.buttons[2] && !previousPad[2]) game!.session.shuffle(Date.now() >>> 0);
    previousPad = event.buttons;
  });
  report('ready', { runtime: Deno.version, os: Deno.build, renderer: 'Deno/wgpu/GLFW', document: 'document' in globalThis,
    adapter: { vendor: adapter.info.vendor, architecture: adapter.info.architecture, device: adapter.info.device, description: adapter.info.description }, size: [window.pixelWidth, window.pixelHeight], game: game.snapshot() });
  engine.run();
  const started = performance.now(); let deadline = started;
  const frameLimit = Number(options['--frames'] ?? Infinity), duration = Number(options['--seconds'] ?? Infinity) * 1000;
  let lastExercise = -1, lastHealth = -1, windowStep = 0;
  while (!window.closed && frames < frameLimit && performance.now() - started < duration) {
    window.poll();
    if (fatal) throw fatal;
    if (options['--window-exercise'] && performance.now() - started > (windowStep + 1) * 1000 && windowStep < 4) {
      if (windowStep === 0) window.minimize();
      if (windowStep === 1) window.restore();
      if (windowStep === 2 || windowStep === 3) window.toggleFullscreen();
      report('window-exercise', { step: windowStep++, size: [window.pixelWidth, window.pixelHeight] });
    }
    if (options['--lose-device-at'] && frames === Number(options['--lose-device-at'])) {
      delete options['--lose-device-at']; engine.device.destroy();
      await new Promise(resolve => setTimeout(resolve, 0)); continue;
    }
    if (!window.minimized && window.pixelWidth > 0 && window.pixelHeight > 0) {
      engine.resizeToDisplaySize();
      if (!window.acquire()) { await new Promise(r => setTimeout(r, 50)); continue; }
      const pending = [...callbacks.values()]; callbacks.clear();
      const now = performance.now(); for (const callback of pending) callback(now);
      if (options['--capture'] && frames === 60) {
        const frame = await window.readFrame(engine.device), image = createCanvas(frame.width, frame.height);
        image.getContext('2d').putImageData(new ImageData(frame.rgba, frame.width, frame.height), 0, 0);
        await Deno.writeFile(options['--capture'], image.toBuffer('image/png'));
        report('capture', { width: frame.width, height: frame.height, path: options['--capture'] });
      }
      if (window.present()) frames++;
    }
    if (options['--exercise'] && frames > 0 && frames % 20 === 0 && frames <= 400 && lastExercise !== frames) {
      lastExercise = frames;
      window.resize(frames % 40 ? 960 : 1100, frames % 40 ? 640 : 740);
      if (frames === 40) game.start('2');
      if (frames === 80) game.session.turn({ axis: 0, layer: 1, direction: 1 });
      if (frames === 120) game.session.restore();
      if (frames === 160) game.start('3');
      if (frames === 200) game.session.shuffle(42);
      if (frames === 240) game.start('4');
      if (frames === 280) game.start('mirror');
      if (frames === 320) game.goHome();
      report('exercise', { frame: frames, game: game.snapshot() });
    }
    if (frames > 0 && frames % 1800 === 0 && frames !== lastHealth) { lastHealth = frames; report('health', { frames, surfaceSkips: window.surfaceSkips, memory: Deno.memoryUsage() }); }
    deadline = Math.max(deadline + 1000 / 60, performance.now());
    await new Promise(resolve => setTimeout(resolve, Math.max(0, deadline - performance.now())));
  }
  report('complete', { frames, surfaceSkips: window.surfaceSkips, elapsedMs: performance.now() - started, game: game.snapshot() });
} finally {
  engine.stop(); callbacks.clear();
  try { await game?.flushSave(); } finally {
  try { game?.dispose();
  if (engine.state === 'ready') await engine.device.queue.onSubmittedWorkDone();
  } finally {
    try { engine.destroy(); } finally {
      try { window.dispose(); } finally {
        restoreWebGpu(); globalThis.requestAnimationFrame = originalRequestFrame; globalThis.cancelAnimationFrame = originalCancelFrame;
      }
    }
  }
  }
}
