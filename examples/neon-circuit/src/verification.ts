import type {NativeHaptics} from '../../../bridge/feedback/haptics.ios';
import { File, knownFolders, path } from '@nativescript/core';
import type { Canvas } from '@nativescript/canvas';
import type { HaiyueEngine } from '@haiyue/engine';
import type { NeonCircuitGame } from '../../../../Games/games/neon-circuit/main';
import { CIRCUITS, BOOST_MAX_SPEED, BOOST_ZONES, RAIL_LIMIT, circuitTrack, createInitialRaceState } from '../../../../Games/games/neon-circuit/RaceRules';
import type { OrbitPointerTarget } from '../../../bridge/input/pointer-target';
import { captureSurfaceFrame } from '../../../bridge/render/frame-capture.ios';
import type { NativeDriving } from './driving';

/** Opt-in fixture through the actual native pointer target and Metal surface. */
export async function verifyNativeNeon(engine: HaiyueEngine, getGame: () => NeonCircuitGame, driving: NativeDriving, target: OrbitPointerTarget, canvas: Canvas,
  safeInsets: () => { top: number; left: number; right: number; bottom: number }, haptics:NativeHaptics): Promise<void> {
  const checks: string[] = [], captures: unknown[] = [], states: unknown[] = [];
  const output = File.fromPath(path.join(knownFolders.documents().path, 'neon-circuit-verification.json'));
  const startedAt = new Date().toISOString();
  const record = (status: string, extra = {}) => output.writeTextSync(JSON.stringify({ schemaVersion: 1, startedAt, updatedAt: new Date().toISOString(), status, checks, captures, states, game: getGame()?.snapshot(), audio:getGame()?.audioState,haptics:haptics.snapshot(), driving: driving.snapshot(), ...extra }, null, 2));
  const check = (value: unknown, name: string) => { if (!value) throw new Error(name); checks.push(name); console.log(`[neon-verify] ${name}`); record('running'); };
  const frame = () => new Promise<void>((resolve, reject) => {
    const callback = () => { clearTimeout(timeout); resolve(); };
    const timeout = setTimeout(() => { engine.off('after-update', callback); reject(new Error('No native frame within 25 seconds')); }, 25000);
    engine.once('after-update', callback);
  });
  const frames = async (n: number) => { for (let i = 0; i < n; i++) await frame(); };
  const until = async (predicate: () => boolean, label: string, maximum = 600) => { for (let i = 0; i < maximum && !predicate(); i++) await frame(); check(predicate(), label); };
  let capture: { name: string; resolve: (value: unknown) => void; reject: (error: unknown) => void } | null = null;
  const onCapture = () => { if (!capture) return; const pending = capture; capture = null; try { pending.resolve(captureSurfaceFrame(canvas, pending.name)); } catch (error) { pending.reject(error); } };
  // Bind before NativeRenderHost's after-update/present observer.
  engine.on('after-update', onCapture);
  const screenshot = async (name: string) => {
    captures.push(await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { capture = null; reject(new Error(`Capture timed out: ${name}`)); }, 25000);
      capture = { name, resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } };
    })); record('running');
  };
  const button = (id: string) => { const b = getGame().guiView.buttonRect(id); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const touch = (action: 'down' | 'move' | 'up', id: number, p: { x: number; y: number }) => target.handle(action, [{ id, ...p }]);
  const click = async (id: string) => { const p = button(id); touch('down', 9001, p); await frames(2); touch('up', 9001, p); await frames(3); };
  try {
    record('running'); await until(() => getGame().modelStatus === 'loaded', 'bundled PBR hovercraft loaded'); await frames(5);
    const rect = target.getBoundingClientRect(), i = safeInsets();
    const audioBank=getGame().audioState.backend as {error:string|null;buffers:number;nodeCount:number};
    check(audioBank.error===null && audioBank.buffers===14 && audioBank.nodeCount===12,'native audio preloads fourteen MIDI-derived effects including 30-second music into a bounded pool');
    check(rect.width > rect.height, 'landscape native Metal surface');
    check(getGame().snapshot().reverseZ && getGame().snapshot().depthFormat === 'depth32float', 'reverse Z and float depth enabled');
    check(getGame().guiView.snapshot.routeCount === 5, 'five shared courses in native carousel');
    check(getGame().guiView.snapshot.language === 'zh' && getGame().guiView.snapshot.title === '极速新星', 'fresh settings default to Chinese and the new title');
    await screenshot('neon-home.png');
    await click('settings');
    check(getGame().guiView.snapshot.settingsVisible,'gear opens the settings panel');
    check(getGame().guiView.snapshot.settingsBackdrop==='#020617a6' && (getGame().audioState.played.click??0)>0,'settings show a translucent backdrop and gear click plays sound');
    const selectedBeforeSettings=getGame().guiView.snapshot.selected;
    getGame().guiView.keyboard('arrowright');
    check(getGame().guiView.snapshot.selected === selectedBeforeSettings,'settings consume carousel keyboard navigation');
    await click('language-en');
    check(getGame().locale === 'en' && getGame().guiView.snapshot.title === 'VELOCITY NOVA','English applies immediately to the GUI');
    await screenshot('neon-settings-en.png'); await click('settings-done'); await screenshot('neon-home-en.png');
    await click('settings'); await click('language-ja');
    check(getGame().locale === 'ja' && getGame().guiView.snapshot.courseName === '天空の港','Japanese applies to circuit labels');
    await screenshot('neon-settings-ja.png'); await click('settings-done'); await screenshot('neon-home-ja.png');
    await click('settings'); await click('language-zh'); await click('settings-done');
    check(!getGame().guiView.snapshot.settingsVisible && getGame().locale === 'zh','settings close and language returns to Chinese');
    const before = getGame().guiView.snapshot.selected, c = getGame().guiView.snapshot.carouselBounds;
    touch('down', 9002, { x: c.x + c.width * 0.60, y: c.y + c.height * 0.4 });
    touch('move', 9002, { x: c.x + c.width * 0.47, y: c.y + c.height * 0.4 });
    await frames(2); touch('up', 9002, { x: c.x + c.width * 0.47, y: c.y + c.height * 0.4 }); await frames(70);
    check(getGame().guiView.snapshot.selected !== before, 'native carousel swipe commits selection');
    check((getGame().audioState.played.course??0)>0,'carousel selection plays its distinct cue');
    getGame().guiView.select('sky-harbor'); await frames(70);
    await click('settings'); await click('steering-joystick'); await click('settings-done'); check(driving.snapshot().mode === 'joystick', 'settings select joystick steering');
    await click('start-race'); await until(() => getGame().snapshot().phase === 'racing', 'countdown starts race');
    check(['count-3','count-2','count-1','go'].every(id=>(getGame().audioState.played as Record<string,number>)[id]===1),'3 2 1 and GO each sound once in the first countdown');
    check(getGame().audioState.musicPlaying,'race starts the looping music');
    const hud = getGame().guiView.snapshot, pauseBounds = getGame().guiView.buttonRect('pause');
    check(hud.courseBounds.y === i.top && hud.courseBounds.height === 30 && hud.timingBounds.y === i.top
      && pauseBounds.y === i.top, 'course title, two-row timing and pause dock to the safe top edge');
    const safeWidth = rect.width - i.left - i.right, safeHeight = rect.height - i.top - i.bottom;
    const expectedDial = (safeWidth < 760 ? 144 : safeHeight < 550 ? 174 : 232) * 0.8;
    check(Math.abs(hud.dialBounds.width - expectedDial) < 0.01 && hud.dialBounds.x === i.left, 'dial is twenty percent smaller and closer to the left edge');
    check(hud.courseBounds.x > hud.dialBounds.x + hud.dialBounds.width
      && hud.courseBounds.x + hud.courseBounds.width < hud.timingBounds.x
      && hud.timingBounds.x + hud.timingBounds.width < pauseBounds.x && pauseBounds.width === pauseBounds.height,
      'compact top HUD does not overlap and pause has a square circular-skin target');
    await frames(12);
    check(getGame().guiView.snapshot.wheel.visible && !getGame().guiView.snapshot.wheel.active && getGame().guiView.snapshot.wheel.opacity<.45,'idle F1 wheel stays visible and translucent');
    await screenshot('neon-wheel-idle.png');
    const throttle = button('control-w'), brake = button('control-s');
    check(brake.x < throttle.x && throttle.x > rect.width / 2 && throttle.y > rect.height / 2, 'brake left and throttle right at bottom-right');
    const bounds = getGame().guiView.snapshot.buttons['control-w']!;
    check(bounds.x + bounds.width <= rect.width - i.right && bounds.y + bounds.height <= rect.height - i.bottom, 'pedals avoid native safe-area edges');
    const center = { x: i.left + 158, y: rect.height - i.bottom - 108 };
    touch('down', 9003, center); await frames(2);
    check(driving.snapshot().joystick!.active && Math.abs(driving.snapshot().joystick!.center.x - center.x) < 0.01
      && Math.abs(driving.snapshot().joystick!.center.y - center.y) < 0.01 && Math.abs(driving.axis) < 0.001, 'floating joystick appears centered at the new touch without steering jump');
    touch('move', 9003, { x: center.x + 18, y: center.y });
    touch('down', 9004, throttle); await frames(12);
    check(getGame().audioState.loops===2 && getGame().audioState.engineLevel>.5,'held throttle starts both bounded engine registers');
    check(driving.axis < -0.1 && getGame().snapshot().speed > 0, 'joystick and throttle work with separate simultaneous touches');
    check(getGame().guiView.snapshot.wheel.visible && getGame().guiView.snapshot.wheel.angle > 0 && getGame().guiView.snapshot.pedalPress.w! > 0.85, 'steering wheel rotates right and throttle depresses under the held finger');
    await screenshot('neon-floating-joystick.png');
    touch('move', 9003, { x: center.x - 18, y: center.y }); await frames(4);
    check(getGame().guiView.snapshot.wheel.angle < 0, 'leftward joystick motion rotates the wheel counterclockwise');
    await screenshot('neon-wheel-left.png');
    touch('up', 9003, center); await frames(3); check(Math.abs(driving.axis) < 0.001, 'releasing joystick returns steering to neutral');
    await frames(12);
    check(getGame().guiView.snapshot.wheel.visible && getGame().guiView.snapshot.wheel.opacity<.45,'released wheel fades back to its translucent idle state');
    const speed = getGame().snapshot().speed; touch('down', 9005, brake); await frames(10);
    check((getGame().audioState.played.brake??0)>0,'moving brake press plays the braking sound');
    check(getGame().snapshot().speed < speed, 'brake slows the car even with throttle held');
    check(getGame().guiView.snapshot.pedalPress.s! > 0.8, 'brake has its own depressed pedal state');
    await screenshot('neon-pedals-down.png');
    target.cancel(); driving.cancel(); getGame().cancelInteraction(); await frames(2);
    check(target.snapshot().trackedTouches === 0 && !driving.snapshot().joystick!.active, 'cancellation releases native driving pointers');
    // Leave enough road before the first boost pad at 8%, including slow device frames.
    const lapLength=circuitTrack(CIRCUITS[0]!).length;
    getGame().setState({...createInitialRaceState(),distance:lapLength-1,speed:500}); await frames(3);
    check(getGame().snapshot().lap===2 && getGame().guiView.snapshot.announcementSkin.visible && getGame().guiView.snapshot.announcementSkin.text==='第 2 / 3 圈' && getGame().guiView.snapshot.announcementSkin.background==='#00000000','crossing a lap shows the generated banner without a solid rectangle');
    check((getGame().audioState.played.lap??0)>0,'crossing a lap plays the lap-complete chime');
    await screenshot('neon-lap-banner.png');
    getGame().setState({ speed: 1000, distance: 500, headingOffset: 0, lateral: 0, lateralSpeed: 0, boostRemaining: 0 });
    touch('down', 9010, throttle); await frames(2);
    const secondCenter = { x: center.x + 38, y: center.y - 18 };
    touch('down', 9011, secondCenter); await frames(2);
    check(driving.snapshot().joystick!.center.x === secondCenter.x && driving.snapshot().joystick!.center.y === secondCenter.y, 'next joystick touch establishes a different center');
    const releasedSpeed = getGame().snapshot().speed;
    const outside = { x: rect.width / 2, y: rect.height * 0.55 };
    touch('move', 9010, outside); touch('up', 9010, outside); await frames(2);
    const firstCoastSpeed = getGame().snapshot().speed;
    check(firstCoastSpeed < releasedSpeed && firstCoastSpeed > releasedSpeed - 30 && driving.snapshot().joystick!.active, 'releasing throttle outside button starts gradual coasting and preserves joystick finger');
    await frames(12);
    check(getGame().snapshot().speed < firstCoastSpeed && getGame().snapshot().wallHits === 0 && getGame().snapshot().boostRemaining === 0, 'released throttle keeps decelerating without wall impact or boost assistance');
    touch('up', 9011, secondCenter); await frames(2);
    await click('pause'); const elapsed = getGame().snapshot().elapsed; await frames(8);
    check(getGame().snapshot().phase === 'paused' && getGame().snapshot().elapsed === elapsed, 'pause freezes race time');
    check(getGame().guiView.snapshot.modalBackdrop === '#00000000' && !getGame().guiView.snapshot.wheel.visible, 'transparent modal blocks input without an outer colored scrim or active wheel');
    check(!getGame().audioState.musicPlaying,'pause stops the music loop');
    check(getGame().audioState.loops===0,'pause stops the engine audio immediately');
    await screenshot('neon-paused.png'); await click('resume'); check(getGame().snapshot().phase === 'racing', 'pause panel resumes race');
    getGame().suspend(); await frames(2); check(getGame().snapshot().phase === 'paused', 'host suspension enters pause safely');
    await click('home-button'); await click('settings'); await click('steering-gyro'); await click('settings-done'); check(driving.snapshot().mode === 'gyro', 'settings select gyroscope steering');
    await click('start-race'); await until(() => getGame().snapshot().phase === 'racing', 'gyro mode starts race'); await frames(25);
    check(driving.snapshot().gyroAvailable && driving.snapshot().sensorSamples > 0, 'real Core Motion samples reach racing controls');
    getGame().setState({ speed: BOOST_MAX_SPEED, boostRemaining: 1 / 240 }); await frames(2);
    check(getGame().snapshot().speed > 1000 && getGame().snapshot().speed < BOOST_MAX_SPEED, 'boost expiry decelerates continuously');
    getGame().setState({ speed: 1000, lateral: RAIL_LIMIT, lateralSpeed: 850, headingOffset: 1 }); await frames(2);
    check(getGame().snapshot().wallHits > 0 && getGame().snapshot().health < 100 && getGame().snapshot().speed < 500, 'wall impact damages hull and sharply slows car');
    check((getGame().audioState.played.rail??0)>0,'real wall impact triggers collision audio');
    await screenshot('neon-driving.png');
    getGame().setState({...createInitialRaceState(),distance:circuitTrack(CIRCUITS[0]!).length*BOOST_ZONES[0],speed:500});await frames(3);
    check((getGame().audioState.played.boost??0)>0 && getGame().snapshot().boostRemaining>0,'crossing a boost strip triggers the rising boost cue');
    for(const [kind,speed,lateralSpeed,headingOffset] of [['light',180,40,.12],['medium',650,450,.55],['heavy',1350,1100,1]] as const) {
      await frames(40);const count=haptics.snapshot().impactsRequested;
      getGame().setState({...createInitialRaceState(),distance:300,speed,lateral:RAIL_LIMIT,lateralSpeed,headingOffset});await frames(3);
      check(haptics.snapshot().impactsRequested>count && haptics.snapshot().lastKind===kind,`actual ${kind} wall impact invokes the matching native haptic`);
    }
    const length = circuitTrack(CIRCUITS[0]!).length;
    getGame().restart(); getGame().setState({ ...createInitialRaceState(), lap: 3, distance: length - 1, speed: 500, elapsed: 120 });
    await until(() => getGame().snapshot().phase === 'finished', 'crossing final finish line opens record result');
    check(getGame().guiView.snapshot.recordStamp.visible, 'a personal best earns the new-record seal');
    await until(() => getGame().guiView.snapshot.recordStamp.age >= 0.28, 'stamp approaches the result corner');
    await screenshot('neon-record-approach.png');
    await until(() => getGame().guiView.snapshot.recordStamp.age >= 1.2, 'stamp lands and settles without restarting each frame');
    check((getGame().audioState.played.record??0)===1 && !getGame().audioState.musicPlaying,'new-record stamp sounds once on landing after music stops');
    await screenshot('neon-record.png');
    await click('restart'); getGame().setState({ ...createInitialRaceState(), lap: 3, distance: length - 1, speed: 500, elapsed: 200 });
    await until(() => getGame().snapshot().phase === 'finished', 'slower race completes normally');
    check(!getGame().guiView.snapshot.recordStamp.visible, 'slower result does not receive or retain the record stamp');
    check((getGame().audioState.played.record??0)===1,'ordinary completion never repeats the record stamp sound');
    await screenshot('neon-finished.png');
    await click('restart'); getGame().setState({ ...createInitialRaceState(), health: 0 });
    await until(() => getGame().snapshot().phase === 'destroyed', 'destroyed hull opens its transparent result panel');
    await screenshot('neon-destroyed.png');
    getGame().showHome(); driving.choose('joystick');
    for (const course of CIRCUITS.slice(1)) {
      getGame().guiView.select(course.id); await frames(70); await click('start-race');
      await until(() => getGame().snapshot().trackId === course.id && getGame().modelStatus === 'loaded', `switch to ${course.id} without browser navigation`);
      await until(() => getGame().snapshot().phase === 'racing', `${course.id} countdown completes`); await frames(3);
      if(course.id === 'rainbow-road') check(getGame().snapshot().space?.planets===3 && getGame().snapshot().space?.meteors===36,'native rainbow course contains planets and meteors');
      if(course.id === 'sky-coaster') {
        for(const section of ['loop','roll','helix']) {
          const rows=circuitTrack(course).samples.filter(s=>s.section===section),sample=rows[Math.floor(rows.length*.5)]!;
          getGame().setState({...createInitialRaceState(),distance:sample.distance}); await frames(8);
          const c=getGame().snapshot().coaster!;
          check(c.section===section && c.roadUp.reduce((sum,v,i)=>sum+v*c.cameraUp[i]!,0)>.8,`native ${section} camera follows the road up vector`);
          if(section!=='helix')check(c.roadUp[1]!<-.9,`native ${section} reaches an inverted road`);
          await screenshot(`neon-coaster-${section}.png`);
        }
      }
      states.push(getGame().snapshot()); await screenshot(`neon-${course.id}.png`); getGame().showHome(); await frames(2);
    }
    await engine.device.queue.onSubmittedWorkDone(); record('passed');
  } catch (error) { console.error('[neon-verify]', error); record('failed', { error: String(error) }); }
  finally { engine.off('after-update', onCapture); target.cancel(); driving.cancel(); getGame()?.cancelInteraction(); }
}
