import {NativeHaptics} from '../../../bridge/feedback/haptics';
import {wallHaptic} from '../../../games/neon-circuit/RacerEffects';
import {NativePcmAudioBank} from '../../../bridge/audio/pcm-bank';
import {NeonAudio} from '../../../games/neon-circuit/audio/NeonAudio';
import {NEON_SOUND_IDS,NEON_SOUNDS} from '../../../games/neon-circuit/audio/Sounds';
import { TEXT, readLanguage } from '../../../games/neon-circuit/NeonLocale';
import { Application, EventData, Label, Page, knownFolders, path, Utils, isAndroid } from '@nativescript/core';
import type { Canvas } from '@nativescript/canvas';
import { LocalStorageSaveBackend, MemorySaveBackend } from '@haiyue/engine/save';
import { NativeSettingsStorage } from '../../../bridge/storage/settings-storage';
import { NativeRenderHost } from '../../../bridge/lifecycle/host';
import { NativeTouchInput } from '../../../bridge/input/native-touch';
import type { NativeCanvasInput } from '../../../bridge/render/surface';
import { OrbitPointerTarget } from '../../../bridge/input/pointer-target';
import { nativeViewRect } from '../../../bridge/render/view-rect';
import { NeonCircuitGame } from '../../../games/neon-circuit/main';
import { NativeNeonRaster } from './raster';
import { NativeModels } from './models';
import { NativeDriving } from './driving';
import { captureNativePointer } from './pointer-capture';
import { nativeLaunchFlag } from '../../../bridge/lifecycle/launch-flags';
import { neonSafeInsets } from './platform';
import { verifyNativeNeon, verifyAndroidNeon } from './verification';

let host: NativeRenderHost | null = null;
let game: NeonCircuitGame | null = null;
let activeCanvas: Canvas | null = null;
const ready = new WeakSet<Canvas>();
const environment = (key: string) => isAndroid
  ? ((Application.android.foregroundActivity ?? Application.android.startActivity)?.getIntent()?.getStringExtra(key) ?? '')
  : String(NSProcessInfo.processInfo.environment.objectForKey(key) ?? '');
export function onCanvasReady(args: EventData): void { const canvas = args.object as Canvas; ready.add(canvas); ensureHost(canvas); }
export function onLoaded(args: EventData): void { const canvas = (args.object as Page).getViewById<Canvas>('surface'); if (canvas && ready.has(canvas)) ensureHost(canvas); }
function unhandled(args: { error?: unknown }): void { host?.fail(args.error); }
function ensureHost(canvas: Canvas): void {
  if (host && activeCanvas !== canvas) disposeHost();
  if (host) return;
  const status = (canvas.page as Page).getViewById<Label>('status');
  const profiling = nativeLaunchFlag('NEON_PERF');
  const benchmarking = profiling && nativeLaunchFlag('NEON_BENCHMARK');
  const requestedProfile = environment('NEON_RENDER_PROFILE');
  const androidProfile = profiling && (requestedProfile === 'simple' || requestedProfile === 'gpu-driven') ? requestedProfile : 'batched';
  const androidVerifying = isAndroid && nativeLaunchFlag('NEON_VERIFY_ANDROID');
  let verifying = androidVerifying || nativeLaunchFlag('NEON_VERIFY');
  let disposed = false, switching = false;
  const haptics=new NativeHaptics();
  let audio: NeonAudio | null = null;
  let models: NativeModels | null = null, driving: NativeDriving | null = null;
  let raster: NativeNeonRaster | null = null;
  let releaseRasterFrame: (()=>void) | null = null;
  let rasterEngine: import('@haiyue/engine').HaiyueEngine | null = null;
  let collectScene = false;
  const target = new OrbitPointerTarget(() => nativeViewRect(canvas), 'all');
  // GUI hover/press ownership can change during a drag or another finger's press.
  // Always release the pedal by identity, even when the finger ends outside it.
  target.addEventListener('pointerup', event => game?.releaseControl(event.pointerId));
  const input = new NativeTouchInput(canvas, sample => {
    if (verifying || benchmarking || switching) return;
    if(sample.action==='down')audio?.unlock();
    if (['down', 'move', 'up', 'cancel'].includes(sample.action)) target.handle(sample.action as 'down' | 'move' | 'up' | 'cancel', sample.points);
    else { target.cancel(); driving?.cancel(); game?.cancelInteraction(); }
  });
  target.addEventListener('pointercancel', () => { driving?.cancel(); game?.cancelInteraction(); });
  // Share one native inset read across the joystick and GUI within a frame.
  let frameInsets: ReturnType<typeof neonSafeInsets> | null = null;
  const invalidateInsets = () => { frameInsets = null; };
  const safeInsets = () => frameInsets ??= neonSafeInsets(canvas);
  canvas.on('layoutChanged', invalidateInsets);
  activeCanvas = canvas;
  host = new NativeRenderHost(canvas, text => { const ok = text.startsWith('原生 WebGPU 已呈现'); status.visibility = ok ? 'collapse' : 'visible'; status.text = ok ? '' : text; }, {
    canvasInput: { addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target),
      setPointerCapture: (id: number) => captureNativePointer(target, id), releasePointerCapture: target.releasePointerCapture.bind(target) } as unknown as NativeCanvasInput,
    engineOptions: { msaaSamples: 4, reverseZ: true, renderProfile: isAndroid ? androidProfile : 'simple', diagnostics: { enabled: profiling && nativeLaunchFlag('NEON_RENDER_DIAGNOSTICS') } }, diagnosticName: 'neon-circuit',
    performance: profiling,
    // Ordinary play keeps lifecycle/error reports but avoids synchronous periodic file writes.
    diagnosticIntervalFrames: profiling ? 120 : 0,
    capture: { requested: nativeLaunchFlag('NEON_CAPTURE_FRAME'), file: 'neon-circuit-frame.png' },
    prepareScene: async engine => {
      engine.on('update', invalidateInsets);
      haptics.resume();
      raster = new NativeNeonRaster(engine.device);rasterEngine=engine;
      releaseRasterFrame=()=>{
        // Native allocations are large while their JS wrappers are small. Collect only at
        // raster/scene boundaries, after the previous scene's async call stack has unwound.
        if((raster?.flushTransient()??0)>0 || collectScene){collectScene=false;Utils.GC();}
      };
      engine.on('after-update',releaseRasterFrame);
      const bank=new NativePcmAudioBank(NEON_SOUND_IDS.map(id=>({id,seconds:NEON_SOUNDS[id].seconds,path:path.join(knownFolders.currentApp().path,'game-assets','audio',`${id}.wav`)})),()=>game?.suspend());
      audio=new NeonAudio(bank);
      models = new NativeModels(engine.device); driving = new NativeDriving(engine, canvas, safeInsets);
      const saveBackend = verifying || benchmarking ? new MemorySaveBackend() : new LocalStorageSaveBackend({ namespace: 'haiyue-games', storage: new NativeSettingsStorage() });
      const preferences = new Map<string,string>();
      const languageStorage = verifying || benchmarking ? {getItem:(key:string) => preferences.get(key) ?? null, setItem:(key:string,value:string) => {preferences.set(key,value);}} : new NativeSettingsStorage();
      status.text = TEXT[readLanguage(languageStorage)].preparing;
      const loadCircuit = async (id: string, race: boolean): Promise<void> => {
        if (disposed) return;
        const next = new NeonCircuitGame(id); game = next;
        await next.initNative(engine, { ...(environment('NEON_MODE')==='duel'?{raceMode:'duel' as const,difficulty:'hard' as const}:{}), haptic:impact=>haptics.impact(wallHaptic(impact)), audio:audio!, languageStorage, raster:raster!, guiFont: raster!.font, modelOptions: models!.options, saveBackend, safeInsets,
          steering: () => driving?.axis ?? 0,
          changeCircuit: id => {
            if (switching || disposed) return;
            switching = true; target.cancel(); driving?.suspend(); next.suspend();
            status.text = TEXT[next.locale].loadingTrack; status.visibility = 'visible';
            // Leave the current GUI update before removing systems and GPU resources.
            void Promise.resolve().then(async () => {
              // Native queue completion is dispatched while the surface is pumped.
              // Keep presenting the paused scene until the fence resolves.
              await next.flushSave(); await engine.device.queue.onSubmittedWorkDone(); engine.stop();
              next.dispose();raster?.releaseScene(); if (disposed) return;
              await loadCircuit(id, true); if (disposed) return;
              // Scene readiness must not depend on periodic diagnostic callbacks.
              status.text = ''; status.visibility = 'collapse';
              if (!Application.inBackground && !Application.suspended) engine.run();
            }).catch(error => host?.fail(error)).finally(() => { switching = false; });
          } }, race);
        if (disposed) { next.dispose(); return; }
        driving!.bind(next); driving!.resume();collectScene=true;
      };
      await loadCircuit(environment('NEON_TRACK') || 'sky-harbor', nativeLaunchFlag('NEON_RACE'));
      if (verifying) void (androidVerifying ? verifyAndroidNeon : verifyNativeNeon)(engine, () => game!, driving!, target, canvas, safeInsets, haptics).finally(() => { verifying = false; target.cancel(); driving?.cancel(); game?.showHome(); });
      return { ...game!.snapshot(), modelStatus: game!.modelStatus, controls: driving.snapshot(), backend: isAndroid ? 'Canvas/wgpu/Vulkan' : 'Canvas/wgpu/Metal' };
    },
    bindInput: () => ({
      suspend() { haptics.suspend(); input.suspend(); driving?.suspend(); game?.suspend(); void game?.flushSave(); },
      resume() { invalidateInsets(); haptics.resume(); input.resume(); driving?.resume(); },
      dispose() { input.dispose(); },
      snapshot() { return { ...input.snapshot(), touches: target.snapshot(), controls: driving?.snapshot(), game: game?.snapshot(),audio:audio?.snapshot(),haptics:haptics.snapshot(),rasterSurfaces:raster?.surfaceCount }; },
    }),
    disposeScene() { disposed = true; canvas.off('layoutChanged', invalidateInsets);rasterEngine?.off('update', invalidateInsets);if(releaseRasterFrame)rasterEngine?.off('after-update',releaseRasterFrame);driving?.dispose(); input.dispose(); target.dispose(); game?.dispose(); game = null; raster?.releaseScene();models?.dispose(); audio?.dispose(); haptics.dispose(); },
  });
  Application.on(Application.uncaughtErrorEvent, unhandled); Application.on(Application.exitEvent, disposeHost);
}
export function onUnloaded(): void { if (!Application.inBackground && !Application.suspended) disposeHost(); }
function disposeHost(): void { Application.off(Application.uncaughtErrorEvent, unhandled); Application.off(Application.exitEvent, disposeHost); host?.dispose(); host = null; activeCanvas = null; }
