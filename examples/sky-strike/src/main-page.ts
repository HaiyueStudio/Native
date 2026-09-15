import {ENEMY_DEFINITIONS} from '../../../../Games/games/sky-strike/rules';
import { NativePcmAudioBank } from '../../../bridge/audio/pcm-bank.ios';
import { SkyStrikeAudio } from '../../../../Games/games/sky-strike/audio/SkyStrikeAudio';
import { SKY_SOUND_IDS, SKY_SOUNDS, SKY_AUDIO_ASSETS, soundPath } from '../../../../Games/games/sky-strike/audio/synthesis';
import { NativeHaptics } from '../../../bridge/feedback/haptics.ios';
import { SkyStrikeLocale } from '../../../../Games/games/sky-strike/i18n';
import { Application, File, knownFolders, path, type EventData, type Page, type Label } from '@nativescript/core';
import { type Canvas } from '@nativescript/canvas';
import { World } from '@haiyue/engine';
import { RenderIntegration } from '@haiyue/engine/experimental';
import { LocalStorageSaveBackend, MemorySaveBackend } from '@haiyue/engine/save';
import type { NativeCanvasInput } from '../../../bridge/render/surface';
import { NativeRenderHost } from '../../../bridge/lifecycle/host';
import { NativeTouchInput } from '../../../bridge/input/native-touch.ios';
import { NativeCanvasTextures } from '../../../bridge/render/canvas-textures.ios';
import { NativeSettingsStorage } from '../../../bridge/storage/settings-storage';
import { SkyStrikeGame } from '../../../../Games/games/sky-strike/SkyStrikeGame';
import { SkyStrikeBattleLayer, unpackSkySprites } from '../../../../Games/games/sky-strike/battleLayer';
import { SkyStrikeGuiHud } from '../../../../Games/games/sky-strike/guiHud';
import { loadSkyStrikeLevels } from '../../../../Games/games/sky-strike/levels/loader';

let host: NativeRenderHost | null = null;
let activeCanvas: Canvas | null = null;
const ready = new WeakSet<Canvas>();
export function onCanvasReady(args: EventData): void { const canvas = args.object as Canvas; ready.add(canvas); ensureHost(canvas); }
export function onLoaded(args: EventData): void { const canvas = (args.object as Page).getViewById<Canvas>('surface'); if (canvas && ready.has(canvas)) ensureHost(canvas); }
function unhandled(args: { error?: unknown }): void { host?.fail(args.error); }
function ensureHost(canvas: Canvas): void {
  if (host && activeCanvas !== canvas) disposeHost();
  if (host) return;
  activeCanvas = canvas;
  const locale = new SkyStrikeLocale(new NativeSettingsStorage());
  const status = (canvas.page as Page).getViewById<Label>('status');
  const input = new NativeTouchInput(canvas, () => {});
  const haptics = new NativeHaptics();
  const musicProbeMode = String(NSProcessInfo.processInfo.environment.objectForKey('SKY_MUSIC_PROBE')) === '1';
  const holeProbeMode = String(NSProcessInfo.processInfo.environment.objectForKey('SKY_HOLE_PROBE')) === '1';
  const quantumProbeMode = String(NSProcessInfo.processInfo.environment.objectForKey('SKY_QUANTUM_PROBE')) === '1';
  const partsProbeMode = String(NSProcessInfo.processInfo.environment.objectForKey('SKY_PARTS_PROBE')) === '1';
  const cinderProbeMode = String(NSProcessInfo.processInfo.environment.objectForKey('SKY_CINDER_PROBE')) === '1';
  const fireProbeMode = cinderProbeMode || String(NSProcessInfo.processInfo.environment.objectForKey('SKY_FIRE_PROBE')) === '1';
  const prismProbeMode = String(NSProcessInfo.processInfo.environment.objectForKey('SKY_PRISM_PROBE')) === '1';
  let game: SkyStrikeGame | null = null;
  let audio: SkyStrikeAudio | null = null;
  let world: World | null = null;
  let textures: NativeCanvasTextures | null = null;
  let detachUpdate = () => {};
  host = new NativeRenderHost(canvas, text => {
    status.visibility = text.startsWith('原生 WebGPU 已呈现') ? 'collapse' : 'visible';
    status.text = locale.text(text.startsWith('正在初始化') ? 'preparing' : 'startupFailed');
  }, {
    diagnosticName: 'sky-strike',
    performance: ['1','detailed'].includes(String(NSProcessInfo.processInfo.environment.objectForKey('SKY_PERF'))),
    engineOptions: { diagnostics: { enabled: String(NSProcessInfo.processInfo.environment.objectForKey('SKY_PERF')) === 'detailed' }, msaaSamples: 4, clearColor: { r: 0.004, g: 0.008, b: 0.03, a: 1 } },
    canvasInput: {
      addEventListener: input.target.addEventListener.bind(input.target),
      removeEventListener: input.target.removeEventListener.bind(input.target),
      setPointerCapture: (id: number) => { if (input.snapshot().primary === id) input.target.setPointerCapture(id); },
      releasePointerCapture: input.target.releasePointerCapture.bind(input.target),
    } as unknown as NativeCanvasInput,
    capture: { requested: String(NSProcessInfo.processInfo.environment.objectForKey('SKY_CAPTURE_FRAME')) === '1', file: 'sky-strike-frame.png' },
    async prepareScene(engine) {
      haptics.resume();
      const surface = engine.canvas!;
      textures = new NativeCanvasTextures(engine.device); // GUI font atlas only, built once.
      const assetsRoot = path.join(knownFolders.currentApp().path, 'game-assets');
      const audioBackend = new NativePcmAudioBank(SKY_AUDIO_ASSETS.map(({id,seconds}) => ({id,path:path.join(assetsRoot,soundPath(id)),seconds})), () => game?.suspend());
      audio = new SkyStrikeAudio(audioBackend, new NativeSettingsStorage());
      const entries = JSON.parse(File.fromPath(path.join(assetsRoot, 'assets/sprites.json')).readTextSync());
      const data = NSData.dataWithContentsOfFile(path.join(assetsRoot, 'assets/sprites.rgba'));
      if (!data) throw new Error('Bundled sprite pack is missing.');
      const bytes = new Uint8Array(interop.bufferFromData(data));
      world = new World('Sky Strike Native');
      const battle = new SkyStrikeBattleLayer(engine, unpackSkySprites(entries, bytes)); world.addSystem(battle);
      const nativeInsets = (canvas.nativeViewProtected as UIView).safeAreaInsets;
      const insets = { top: nativeInsets.top, bottom: nativeInsets.bottom };
      const ui = new SkyStrikeGuiHud(world, id => battle.guiImage(id), insets, locale);
      const levels = await loadSkyStrikeLevels(async source => JSON.parse(File.fromPath(path.join(assetsRoot, source)).readTextSync()));
      game = new SkyStrikeGame(surface, battle, engine, world, {
        ui, locale, levels, audio, keyboard: false, guiLoadOp: 'load',
        haptic: event => haptics.impact(event === 'boss-defeated' || event === 'player-destroyed' ? 'heavy' : event === 'bomb' ? 'medium' : 'light'),
        acceptsGameplayInput: (_x, y) => y >= insets.top + 94 && y <= surface.getBoundingClientRect().height - insets.bottom - 94,
        saveBackend: (musicProbeMode||holeProbeMode||prismProbeMode||quantumProbeMode||partsProbeMode||fireProbeMode) ? new MemorySaveBackend() : new LocalStorageSaveBackend({ namespace: 'haiyue-games', storage: new NativeSettingsStorage() }),
        guiFont: { canvasFactory: textures.createCanvas2D, readAtlasPixels: textures.readAtlasPixels },

      });
      await game.init();
      const integration = new RenderIntegration(engine, { label: 'SkyStrike.native' });
      world.addRuntimeIntegration(integration); integration.registerAll(world);
      // Explicit launch-only diagnostic, inactive during normal play. Exercises native scheduling on-device.
      let holeProbeMs=0,holeProbeSampleMs=0,holeProbeForced=false,holeProbeDone=false;
      const holeProbeSamples:unknown[]=[];
      if(holeProbeMode){const diagnostic=game as any;diagnostic.selectedLevelIndex=8;diagnostic.startSortie();diagnostic.player.invulnerableMs=999999;diagnostic.pointerFiring=true;}
      let prismProbeMs=0,prismSampleMs=0,prismLaser=false,prismBroken=false,prismDone=false;
      const prismSamples:unknown[]=[];
      if(prismProbeMode){const d=game as any;d.selectedLevelIndex=9;d.startSortie();d.levelTimeline=[];d.player.invulnerableMs=999999;d.pointerFiring=true;const boss=d.spawnEnemy(ENEMY_DEFINITIONS.find(e=>e.id==='crystal-prism'),240,160);boss.entered=true;d.spawnEnemy(ENEMY_DEFINITIONS.find(e=>e.id==='mirror-triangle'),240,340);}
      let quantumProbeMs=0,quantumSampleMs=0,quantumDone=false,quantumDefeated=false,quantumCritical=false;
      const quantumSamples:unknown[]=[];
      let fireMs=0,fireSampleMs=0,fireDone=false;
      const fireSamples:unknown[]=[];
      if(fireProbeMode){const d=game as any;d.selectedLevelIndex=levels.findIndex(l=>l.number===11);d.startSortie();d.player.invulnerableMs=999999;d.flameProtectionMs=999999;d.pointerFiring=false;if(!cinderProbeMode){d.levelTimeline=[];const boss=d.spawnEnemy(ENEMY_DEFINITIONS.find(e=>e.id==='inferno-ark'),240,145);boss.entered=true;}}
      const partsIds=['iron-serpent','dreadnought','ion-seraph','void-mantis','star-carrier','helios-prism','ore-reaper','crimson-lance','violet-fortress','prism-lancer','fission-elite','twin-red','quantum-dreadnought'];
      let partsMs=0,partsIndex=-1,partsDone=false,partsSampleMs=0;
      const partsSamples:unknown[]=[];
      if(partsProbeMode){const d=game as any;d.selectedLevelIndex=5;d.startSortie();d.levelTimeline=[];d.player.invulnerableMs=999999;d.pointerFiring=false;}
      if(quantumProbeMode){const d=game as any;d.selectedLevelIndex=levels.findIndex(l=>l.id==='quantum-armada');d.startSortie();d.levelTimeline=[];d.player.invulnerableMs=999999;d.player.x=90;d.player.y=560;d.pointerFiring=true;const boss=d.spawnEnemy(ENEMY_DEFINITIONS.find(e=>e.id==='quantum-dreadnought'),240,180);boss.entered=true;d.spawnEnemy(ENEMY_DEFINITIONS.find(e=>e.id==='bomber'),100,300,true);}
      const probe = String(NSProcessInfo.processInfo.environment.objectForKey('SKY_AUDIO_PROBE')) === '1';
      let probeElapsed = 0, probeIndex = 0;
      const probeResults: unknown[] = [];
      if (probe) audio.resume();
      const musicStarted=NSProcessInfo.processInfo.systemUptime;
      let musicSample=0,musicDone=false;
      const musicSamples:unknown[]=[];
      if(musicProbeMode){const d=game as any;d.selectedLevelIndex=0;d.startSortie();d.levelTimeline=[];d.player.invulnerableMs=999999;d.pointerFiring=false;}

      const update = ({ detail: { time, delta } }: { detail: { time: number; delta: number } }) => {
        if(partsProbeMode&&!partsDone){
          const d=game as any;partsMs+=Math.min(34,delta);partsSampleMs+=Math.min(34,delta);
          const index=partsMs<5000?0:Math.min(partsIds.length-1,1+Math.floor((partsMs-5000)/1500));
          if(index!==partsIndex){partsIndex=index;d.enemies=[];d.enemyBullets=[];d.hostileLasers=[];d.boss=null;d.twins=null;d.bossLaser=null;const boss=d.spawnEnemy(ENEMY_DEFINITIONS.find(e=>e.id===partsIds[index]),240,index===0?480:200);boss.entered=true;}
        }
        game!.update(delta);
        world!.update(time, delta);
        if(musicProbeMode&&!musicDone){
          const seconds=NSProcessInfo.processInfo.systemUptime-musicStarted;
          if(seconds>=musicSample){musicSamples.push({seconds,audio:audio!.snapshot()});musicSample+=5;}
          if(seconds>=42){
            game!.suspend();musicDone=true;
            File.fromPath(path.join(knownFolders.documents().path,'sky-music-probe.json')).writeTextSync(JSON.stringify({samples:musicSamples,final:audio!.snapshot(),complete:true,memorySave:true}));
          }
        }
        if(fireProbeMode&&!fireDone){
          fireMs+=Math.min(34,delta);fireSampleMs+=Math.min(34,delta);
          if(fireSampleMs>=1000){fireSamples.push(game!.snapshot());fireSampleMs=0;File.fromPath(path.join(knownFolders.documents().path,cinderProbeMode?'sky-cinder-probe.json':'sky-fire-probe.json')).writeTextSync(JSON.stringify({samples:fireSamples,elapsedMs:fireMs,complete:fireMs>=18000,memorySave:true,naturalTimeline:cinderProbeMode}));}
          if(fireMs>=18000){game!.suspend();fireDone=true;File.fromPath(path.join(knownFolders.documents().path,cinderProbeMode?'sky-cinder-probe.json':'sky-fire-probe.json')).writeTextSync(JSON.stringify({samples:fireSamples,elapsedMs:fireMs,complete:true,memorySave:true,naturalTimeline:cinderProbeMode}));}
        }
        if(partsProbeMode&&!partsDone){
          if(partsSampleMs>=500){partsSamples.push({id:partsIds[partsIndex],state:game!.snapshot()});partsSampleMs=0;}
          if(partsMs>=23000){game!.suspend();partsDone=true;File.fromPath(path.join(knownFolders.documents().path,'sky-parts-probe.json')).writeTextSync(JSON.stringify({samples:partsSamples,final:game!.snapshot(),memorySave:true}));}
        }
        if(holeProbeMode&&!holeProbeDone){
          holeProbeMs+=Math.min(34,delta);holeProbeSampleMs+=Math.min(34,delta);
          if(holeProbeSampleMs>=1000){holeProbeSamples.push(game!.snapshot());holeProbeSampleMs=0;}
          if(holeProbeMs>=8000&&!holeProbeForced){(game as any).blackHole.absorb(1200);holeProbeForced=true;}
          if(holeProbeMs>=38000){game!.suspend();holeProbeDone=true;File.fromPath(path.join(knownFolders.documents().path,'sky-hole-probe.json')).writeTextSync(JSON.stringify({samples:holeProbeSamples,final:game!.snapshot(),forcedThreshold:true,memorySave:true}));}
        }
        if(quantumProbeMode&&!quantumDone){
          const d=game as any;quantumProbeMs+=Math.min(34,delta);quantumSampleMs+=Math.min(34,delta);
          if(quantumSampleMs>=250){quantumSamples.push(game!.snapshot());quantumSampleMs=0;}
          if(quantumProbeMs>=6000&&!quantumCritical){if(d.boss)d.boss.hitPoints=d.boss.definition.hitPoints*.34;quantumCritical=true;d.player.x=390;}
          if(quantumProbeMs>=12000&&!quantumDefeated){if(d.boss)d.damageEnemy(d.enemies.indexOf(d.boss),d.boss,999999);quantumDefeated=true;}
          if(quantumProbeMs>=16000){game!.suspend();quantumDone=true;File.fromPath(path.join(knownFolders.documents().path,'sky-quantum-probe.json')).writeTextSync(JSON.stringify({samples:quantumSamples,final:game!.snapshot(),forcedBossDeath:true,memorySave:true}));}
        }
        if(prismProbeMode&&!prismDone){
          prismProbeMs+=Math.min(34,delta);prismSampleMs+=Math.min(34,delta);
          const d=game as any;
          if(prismProbeMs>=5000&&!prismLaser){d.weaponForm='purple';d.weaponLevel=1;prismLaser=true;}
          if(prismProbeMs>=11000&&!prismBroken){if(d.boss)d.spendMirrorBudget(d.boss,99999);prismBroken=true;}
          if(prismSampleMs>=1000){prismSamples.push(game!.snapshot());prismSampleMs=0;}
          if(prismProbeMs>=19000){game!.suspend();prismDone=true;File.fromPath(path.join(knownFolders.documents().path,'sky-prism-probe.json')).writeTextSync(JSON.stringify({samples:prismSamples,final:game!.snapshot(),forcedOverload:true,memorySave:true}));}
        }
        if (probe && probeIndex <= SKY_SOUND_IDS.length && audio!.snapshot().active) {
          probeElapsed += delta;
          if (probeElapsed >= 1800) {
            probeElapsed = 0; audio!.stop();
            if (probeIndex < SKY_SOUND_IDS.length) {
              const id = SKY_SOUND_IDS[probeIndex]!;
              if (id === 'laser-loop') audio!.lasers(true, false);
              else if (id === 'laser-enemy') audio!.lasers(false, true);
              else audio!.play(id);
              probeResults.push({id, audio: audio!.snapshot()});
            } else {
              audio!.pause();
              File.fromPath(path.join(knownFolders.documents().path, 'sky-strike-audio-probe.json')).writeTextSync(JSON.stringify({effects: probeResults, final: audio!.snapshot()}));
            }
            probeIndex++;
          }
        }
      };
      engine.on('update', update); detachUpdate = () => engine.off('update', update);
      return { ...game.snapshot(), bundledImages: entries.length, levels: levels.length, textures: textures.snapshot() };
    },
    bindInput() { return {
      suspend() { haptics.suspend(); input.suspend(); game?.suspend(); }, resume() { haptics.resume(); input.resume(); },
      dispose() { input.dispose(); }, snapshot() { return { ...input.snapshot(), game: game?.snapshot(), haptics: haptics.snapshot(), textures: textures?.snapshot() }; },
    }; },
    disposeScene() { haptics.dispose(); audio?.dispose(); detachUpdate(); input.dispose(); game?.dispose(); world?.destroy(); textures?.dispose();  },
  });
  Application.on(Application.uncaughtErrorEvent, unhandled); Application.on(Application.exitEvent, disposeHost);
}
export function onUnloaded(): void { if (!Application.inBackground && !Application.suspended) disposeHost(); }
function disposeHost(): void { Application.off(Application.uncaughtErrorEvent, unhandled); Application.off(Application.exitEvent, disposeHost); host?.dispose(); host = null; activeCanvas = null; }
