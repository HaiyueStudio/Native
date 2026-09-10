import { verifyTwinStick } from '../../../../Games/games/ak47-range/twin-stick-verification';
import { File, knownFolders, path } from '@nativescript/core';
import type { Canvas } from '@nativescript/canvas';
import { captureSurfaceFrame } from '../../../bridge/render/frame-capture.ios';
import type { OrbitPointerTarget } from '../../../bridge/input/pointer-target';
import { type RangeGame } from '../../../../Games/games/ak47-range/RangeGame';
/** Only runs with RANGE_VERIFY=1. Uses the same native pointer target as UITouch input. */
export async function verifyNativeRange(game: RangeGame, target: OrbitPointerTarget, canvas: Canvas, feedback: () => { recoilPulses: number; hitPulses: number }): Promise<void> {
  const checks: string[] = [];
  const check = (value: unknown, name: string) => { if (!value) throw new Error(name); checks.push(name); };
  const frame = () => new Promise<void>(resolve => game.engine.once('after-update', () => resolve()));
  const frames = async (n: number) => { for (let i = 0; i < n; i++) await frame(); };
  const output = File.fromPath(path.join(knownFolders.documents().path, 'ak47-range-verification.json'));
  let captureResolve: ((value: unknown) => void) | null = null;
  let captureReject: ((error: unknown) => void) | null = null;
  // Registered during prepareScene, before NativeRenderHost's present listener.
  const captureFrame = () => {
    if (!captureResolve) return;
    const resolve = captureResolve; captureResolve = null;
    try { resolve(captureSurfaceFrame(canvas, 'ak47-range-verified.png')); }
    catch (error) { captureReject?.(error); }
  };
  game.engine.on('after-update', captureFrame);
  try {
    await frames(15);
    check(game.snapshot().weaponAttached, 'native glTF character and right-hand AK47 loaded');
    const { width, height } = target.getBoundingClientRect();
    check(width > height, 'native app is landscape');
    const windowBounds = (canvas.nativeViewProtected as UIView).window.bounds;
    check(Math.abs(width - windowBounds.size.width) < 1 && Math.abs(height - windowBounds.size.height) < 1, 'native canvas fills the entire window');
    const insets = game.snapshot().safeInsets, actions = game.hudActions();
    check(actions.fire.x + actions.fire.width <= width - insets.right && actions.fire.y + actions.fire.height <= height - insets.bottom &&
      game.joystickCenter(width, height).x - 71 >= insets.left, 'controls stay inside the native safe area');
    const { x: cx, y: cy } = game.joystickCenter(width, height);
    const before = game.snapshot();
    target.handle('down', [{ id: 9201, x: cx, y: cy }]);
    target.handle('move', [{ id: 9201, x: cx + 45, y: cy - 20 }]);
    await frames(30);
    check(game.playerTransform.position[0]! > before.player[0]! + 0.2, 'native joystick moves character');
    check(game.orbit.target[0]! > before.cameraTarget[0]! + 0.1, 'native camera follows');
    const fire = game.hudActions().fire;
    target.handle('down', [{ id: 9202, x: fire.x + 48, y: fire.y + 48 }]);
    await frames(50);
    check(game.rules.shots >= 3 && game.controls.state.active, 'native second pointer fires while running');
    target.handle('up', [{ id: 9202, x: fire.x + 48, y: fire.y + 48 }]);
    target.handle('up', [{ id: 9201, x: cx, y: cy }]);
    const shots = game.rules.shots;
    await frames(10); check(shots === game.rules.shots, 'native release stops fire');
    const reload = game.hudActions().reload;
    target.handle('down', [{ id: 9202, x: reload.x + 44, y: reload.y + 24 }]);
    target.handle('up', [{ id: 9202, x: reload.x + 44, y: reload.y + 24 }]);
    await frames(2); check(game.rules.reloadRemaining > 0, 'native Engine GUI starts reload');
    for (let i = 0; i < 500 && game.rules.reloadRemaining > 0; i++) await frame();
    check(game.rules.ammo === 30 && game.rules.reloadRemaining === 0, 'native reload completes');
    target.handle('down', [{ id: 9202, x: fire.x + 48, y: fire.y + 48 }]); target.cancel();
    check(!game.rules.firing && !game.controls.state.active, 'native cancellation clears both actions');
    checks.push(...await verifyTwinStick(game, (type, id, x, y) => target.handle(type.slice(7) as 'down' | 'move' | 'up' | 'cancel', [{ id, x, y }]), frames, [9201, 9202]));
    game.restart();
    game.rules.spawnEnemy({ x: 1, z: -2 });
    game.rules.spawnEnemy({ x: 0, z: 7 });
    game.rules.spawnEnemy({ x: 5, z: -6 });
    await frames(2);
    check(game.snapshot().enemies[0]!.visible, 'front enemy visible inside 90-degree cone');
    check(!game.snapshot().enemies[1]!.visible, 'rear enemy hidden');
    check(!game.snapshot().enemies[2]!.visible, 'cover blocks enemy visibility');
    check(game.snapshot().renderedEnemies === game.snapshot().enemies.filter(e => e.visible).length, 'hidden enemies excluded from rendering');
    await frames(100);
    check(game.rules.health < 100 && game.rules.damageEvents > 0, 'enemy acquires player and bullets inflict damage');
    await frames(35);
    check(feedback().recoilPulses >= 3, 'continuous shots request light recoil feedback');
    check(feedback().hitPulses > 0, 'enemy hits request medium feedback');
    // Let the restarted scene re-enable controls before sending the preview gesture.
    game.restart(); game.rules.spawnEnemy({ x: 1, z: -2 }); await frames(2);
    const move = game.controls.state.center, aim = game.aimControls.state.center;
    target.handle('down', [{ id: 9201, x: move.x, y: move.y }]);
    target.handle('move', [{ id: 9201, x: move.x + 42, y: move.y }]);
    target.handle('down', [{ id: 9202, x: aim.x, y: aim.y }]);
    target.handle('move', [{ id: 9202, x: aim.x - 20, y: aim.y - 36 }]);
    await frames(3);
    // Capture synchronously inside after-update before the host presents the acquired texture.
    const capture = await new Promise((resolve, reject) => { captureResolve = resolve; captureReject = reject; });
    output.writeTextSync(JSON.stringify({ status: 'passed', checks, capture, haptics: feedback(), ...game.snapshot() }, null, 2));
  } catch (error) { output.writeTextSync(JSON.stringify({ status: 'failed', checks, error: String(error), ...game.snapshot() }, null, 2)); }
  finally { game.engine.off('after-update', captureFrame); target.cancel(); game.cancelInteraction(); }
}
