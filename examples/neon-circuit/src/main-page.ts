import {NativeHaptics} from '../../../bridge/feedback/haptics.ios';
import {wallHaptic} from '../../../../Games/games/neon-circuit/RacerEffects';
import {NativePcmAudioBank} from '../../../bridge/audio/pcm-bank.ios';
import {NeonAudio} from '../../../../Games/games/neon-circuit/audio/NeonAudio';
import {NEON_SOUND_IDS,NEON_SOUNDS} from '../../../../Games/games/neon-circuit/audio/Sounds';
import { TEXT, readLanguage } from '../../../../Games/games/neon-circuit/NeonLocale';
import { Application, EventData, Label, Page, knownFolders, path } from '@nativescript/core';
import type { Canvas } from '@nativescript/canvas';
import { LocalStorageSaveBackend, MemorySaveBackend } from '@haiyue/engine/save';
import { NativeSettingsStorage } from '../../../bridge/storage/settings-storage';
import { NativeRenderHost } from '../../../bridge/lifecycle/host';
import { NativeTouchInput } from '../../../bridge/input/native-touch.ios';
import type { NativeCanvasInput } from '../../../bridge/render/surface';
import { OrbitPointerTarget } from '../../../bridge/input/pointer-target';
import { nativeViewRect } from '../../../bridge/render/view-rect.ios';
import { NeonCircuitGame } from '../../../../Games/games/neon-circuit/main';
import { NativeNeonRaster } from './raster';
import { NativeModels } from './models';
import { NativeDriving } from './driving';
import { captureNativePointer } from './pointer-capture';
import { verifyNativeNeon } from './verification';

let host: NativeRenderHost | null = null;
let game: NeonCircuitGame | null = null;
let activeCanvas: Canvas | null = null;
const ready = new WeakSet<Canvas>();
const environment = (key: string) => String(NSProcessInfo.processInfo.environment.objectForKey(key) ?? '');
export function onCanvasReady(args: EventData): void { const canvas = args.object as Canvas; ready.add(canvas); ensureHost(canvas); }
export function onLoaded(args: EventData): void { const canvas = (args.object as Page).getViewById<Canvas>('surface'); if (canvas && ready.has(canvas)) ensureHost(canvas); }
function unhandled(args: { error?: unknown }): void { host?.fail(args.error); }
function ensureHost(canvas: Canvas): void {
  if (host && activeCanvas !== canvas) disposeHost();
  if (host) return;
  const status = (canvas.page as Page).getViewById<Label>('status');
  let verifying = environment('NEON_VERIFY') === '1';
  let disposed = false, switching = false;
  const haptics=new NativeHaptics();
  let audio: NeonAudio | null = null;
  let models: NativeModels | null = null, driving: NativeDriving | null = null;
  const target = new OrbitPointerTarget(() => nativeViewRect(canvas), 'all');
  // GUI hover/press ownership can change during a drag or another finger's press.
  // Always release the pedal by identity, even when the finger ends outside it.
  target.addEventListener('pointerup', event => game?.releaseControl(event.pointerId));
  const input = new NativeTouchInput(canvas, sample => {
    if (verifying || switching) return;
    if(sample.action==='down')audio?.unlock();
    if (['down', 'move', 'up', 'cancel'].includes(sample.action)) target.handle(sample.action as 'down' | 'move' | 'up' | 'cancel', sample.points);
    else { target.cancel(); driving?.cancel(); game?.cancelInteraction(); }
  });
  target.addEventListener('pointercancel', () => { driving?.cancel(); game?.cancelInteraction(); });
  const safeInsets = () => { const i = (canvas.nativeViewProtected as UIView).safeAreaInsets; return { top: i.top, right: i.right, bottom: i.bottom, left: i.left }; };
  activeCanvas = canvas;
  host = new NativeRenderHost(canvas, text => { const ok = text.startsWith('原生 WebGPU 已呈现'); status.visibility = ok ? 'collapse' : 'visible'; status.text = ok ? '' : text; }, {
    canvasInput: { addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target),
      setPointerCapture: (id: number) => captureNativePointer(target, id), releasePointerCapture: target.releasePointerCapture.bind(target) } as unknown as NativeCanvasInput,
    engineOptions: { msaaSamples: 4, reverseZ: true }, diagnosticName: 'neon-circuit',
    capture: { requested: environment('NEON_CAPTURE_FRAME') === '1', file: 'neon-circuit-frame.png' },
    prepareScene: async engine => {
      haptics.resume();
      const raster = new NativeNeonRaster(engine.device);
      const bank=new NativePcmAudioBank(NEON_SOUND_IDS.map(id=>({id,seconds:NEON_SOUNDS[id].seconds,path:path.join(knownFolders.currentApp().path,'game-assets','audio',`${id}.wav`)})),()=>game?.suspend());
      audio=new NeonAudio(bank);
      models = new NativeModels(engine.device); driving = new NativeDriving(engine, canvas, safeInsets);
      const saveBackend = verifying ? new MemorySaveBackend() : new LocalStorageSaveBackend({ namespace: 'haiyue-games', storage: new NativeSettingsStorage() });
      const preferences = new Map<string,string>();
      const languageStorage = verifying ? {getItem:(key:string) => preferences.get(key) ?? null, setItem:(key:string,value:string) => {preferences.set(key,value);}} : new NativeSettingsStorage();
      status.text = TEXT[readLanguage(languageStorage)].preparing;
      const loadCircuit = async (id: string, race: boolean): Promise<void> => {
        if (disposed) return;
        const next = new NeonCircuitGame(id); game = next;
        await next.initNative(engine, { haptic:impact=>haptics.impact(wallHaptic(impact)), audio:audio!, languageStorage, raster, guiFont: raster.font, modelOptions: models!.options, saveBackend, safeInsets,
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
              next.dispose(); if (disposed) return;
              await loadCircuit(id, true); if (!disposed && !Application.inBackground && !Application.suspended) engine.run();
            }).catch(error => host?.fail(error)).finally(() => { switching = false; });
          } }, race);
        if (disposed) { next.dispose(); return; }
        driving!.bind(next); driving!.resume();
      };
      await loadCircuit(environment('NEON_TRACK') || 'sky-harbor', environment('NEON_RACE') === '1');
      if (verifying) void verifyNativeNeon(engine, () => game!, driving!, target, canvas, safeInsets, haptics).finally(() => { verifying = false; target.cancel(); driving?.cancel(); game?.showHome(); });
      return { ...game!.snapshot(), modelStatus: game!.modelStatus, controls: driving.snapshot(), backend: 'Canvas/wgpu/Metal' };
    },
    bindInput: () => ({
      suspend() { haptics.suspend(); input.suspend(); driving?.suspend(); game?.suspend(); void game?.flushSave(); },
      resume() { haptics.resume(); input.resume(); driving?.resume(); },
      dispose() { input.dispose(); },
      snapshot() { return { ...input.snapshot(), touches: target.snapshot(), controls: driving?.snapshot(), game: game?.snapshot(),audio:audio?.snapshot(),haptics:haptics.snapshot() }; },
    }),
    disposeScene() { disposed = true; driving?.dispose(); input.dispose(); target.dispose(); game?.dispose(); game = null; models?.dispose(); audio?.dispose(); haptics.dispose(); },
  });
  Application.on(Application.uncaughtErrorEvent, unhandled); Application.on(Application.exitEvent, disposeHost);
}
export function onUnloaded(): void { if (!Application.inBackground && !Application.suspended) disposeHost(); }
function disposeHost(): void { Application.off(Application.uncaughtErrorEvent, unhandled); Application.off(Application.exitEvent, disposeHost); host?.dispose(); host = null; activeCanvas = null; }
