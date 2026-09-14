import { ApplicationSettings } from '@nativescript/core';
import type { Canvas } from '@nativescript/canvas';
import type { HaiyueEngine } from '@haiyue/engine';
import { VirtualJoystickControls } from '@haiyue/extensions/controls';
import { NativeDeviceMotion, type MotionScreenRotation } from '../../../bridge/motion/device-motion.ios';
import type { NeonCircuitGame } from '../../../../Games/games/neon-circuit/main';
import { TiltSteering, landscapeMotionRotation, type SteeringMode } from './steering';

export class NativeDriving {
  private readonly motion = new NativeDeviceMotion();
  private readonly tilt = new TiltSteering();
  private joystick: VirtualJoystickControls | null = null;
  private game: NeonCircuitGame | null = null;
  private running = false;
  private active = false;
  private rotation: MotionScreenRotation = 0;
  private mode: SteeringMode = ApplicationSettings.getString('neon.steering', 'joystick') === 'gyro' ? 'gyro' : 'joystick';
  private sensorSamples = 0;
  constructor(private readonly engine: HaiyueEngine, private readonly canvas: Canvas, private readonly insets: () => { left: number; bottom: number }) {
    // Registered before game updates so steering is frame-consistent.
    engine.on('update', this.frame);
  }
  bind(game: NeonCircuitGame): void {
    this.joystick?.destroy(); this.game = game; this.tilt.reset(); this.active = false;
    if (this.mode === 'gyro' && !this.motion.available) this.mode = 'joystick';
    game.guiView.configureMobileControls(this.mode, this.choose, this.motion.available);
    this.joystick = new VirtualJoystickControls(this.engine.canvas!, {
      mode: 'floating', maxDistance: 46, knobRadius: 23, deadZone: 0.10,
      center: ({ height }) => ({ x: this.insets().left + 98, y: height - this.insets().bottom - 92 }),
      region: ({ width, height }) => ({ x: this.insets().left, y: height * 0.5, width: width * 0.45, height: height * 0.5 - this.insets().bottom }),
      shouldActivate: () => this.running && this.mode === 'joystick' && this.canDrive(),
      baseStyle: { backgroundColor: '#0c314866', borderColor: '#55eaffaa' },
      knobStyle: { backgroundColor: '#51d8eb99', borderColor: '#c6faffdd' },
    });
    this.joystick.disabled = true;
  }
  readonly choose = (mode: SteeringMode): void => {
    if (mode === 'gyro' && !this.motion.available) return;
    this.mode = mode; ApplicationSettings.setString('neon.steering', mode);
    this.cancel(); this.motion.stop(); this.game?.cancelInteraction(); this.game?.guiView.updateMobileMode(mode);
  };
  private canDrive(): boolean { const phase = this.game?.snapshot().phase; return phase === 'racing' || phase === 'countdown'; }
  private readonly frame = ({ detail }: { detail: { delta: number } }): void => {
    const active = this.running && this.canDrive();
    if (active !== this.active) { this.tilt.reset(); this.active = active; }
    if (this.joystick) { this.joystick.disabled = !active || this.mode !== 'joystick'; this.joystick.step(detail.delta); }
    const wheel = this.joystick?.state;
    this.game?.guiView.updateWheel(!!wheel?.active && active && this.mode === 'joystick', wheel?.center.x ?? 0, wheel?.center.y ?? 0, this.axis, active && this.mode === 'joystick');
    if (!active || this.mode !== 'gyro') { if (this.motion.active) this.motion.stop(); return; }
    const orientation = ((this.canvas.nativeViewProtected as UIView).window?.windowScene as UIWindowScene | undefined)?.interfaceOrientation;
    const rotation: MotionScreenRotation = orientation === UIInterfaceOrientation.LandscapeLeft ? landscapeMotionRotation('left') : orientation === UIInterfaceOrientation.LandscapeRight ? landscapeMotionRotation('right') : 0;
    if (rotation !== this.rotation) { this.rotation = rotation; this.motion.setScreenRotation(rotation); this.tilt.reset(); }
    if (!this.motion.active) this.motion.start();
    const sample = this.motion.update(detail.delta);
    if (sample) { this.sensorSamples++; this.tilt.update(sample.tilt.right, detail.delta); }
  };
  get axis(): number {
    if (!this.running || !this.canDrive()) return 0;
    if (this.mode === 'gyro') return this.tilt.axis;
    const state = this.joystick?.state;
    return state ? -state.direction.x * state.strength : 0;
  }
  cancel(): void { this.joystick?.cancel(); this.tilt.reset(); this.game?.guiView.updateWheel(false, 0, 0, 0); }
  suspend(): void { this.running = false; this.cancel(); this.motion.stop(); }
  resume(): void { this.running = true; this.tilt.reset(); }
  snapshot() { return { mode: this.mode, axis: this.axis, joystick: this.joystick?.state, gyroAvailable: this.motion.available, gyroActive: this.motion.active, sensorSamples: this.sensorSamples, rotation: this.rotation }; }
  dispose(): void { this.suspend(); this.engine.off('update', this.frame); this.joystick?.destroy(); this.motion.dispose(); this.game = null; }
}
