import { CartesianTransform3D, OrbitControl, SphericalTransform3D, type HaiyueEngine } from '@haiyue/engine';
import type { Canvas } from '@nativescript/canvas';
import { NativeTouchInput, type NativeTouchSample } from '../../../bridge/input/native-touch.ios';
import type { NativeHostInput } from '../../../bridge/lifecycle/host';

export function bindOrbit(engine: HaiyueEngine, view: Canvas, report: (event: string, detail: unknown) => void): NativeHostInput {
  const scene = engine.activeScene;
  const camera = scene?.cameraEntity.getComponent(SphericalTransform3D);
  const cube = [...(scene?.world.entities.values() ?? [])].find(entity => entity.name === 'Static copper cube')?.getComponent(CartesianTransform3D);
  if (!camera || !cube) throw new Error('PBR scene camera or cube missing during Orbit binding.');
  const sampleScene = () => ({ theta: camera.theta, phi: camera.phi, radius: camera.radius, target: [...camera.target], cubeMatrix: [...cube.localMatrix] });
  const detailed = String(NSProcessInfo.processInfo.environment.objectForKey('G04_DIAGNOSTICS')) === '1';
  const samples: unknown[] = [];
  let lastSample = 0;
  let input: NativeTouchInput;
  const onTouch = (event: NativeTouchSample) => {
    const now = Date.now();
    if (detailed && (event.action !== 'move' || now - lastSample >= 100)) {
      lastSample = now;
      if (samples.length < 128) samples.push({ time: now, ...event, scene: sampleScene() });
    }
    if (event.action !== 'move') {
      report('touch', { ...event, scene: sampleScene(), samples: samples.splice(0) });
    }
  };
  input = new NativeTouchInput(view, onTouch);
  // Only this audited native event target is cast; Engine and its math are unchanged.
  const orbit = new OrbitControl(input.target as unknown as HTMLCanvasElement, camera, {
    enableRotate: true, enablePan: false, enableZoom: false,
    minPhi: 0.1, maxPhi: Math.PI - 0.1,
  });
  report('orbit-created', { detailed, options: { enableRotate: orbit.enableRotate, enablePan: orbit.enablePan, enableZoom: orbit.enableZoom, minPhi: orbit.minPhi, maxPhi: orbit.maxPhi }, rect: input.target.getBoundingClientRect(), scene: sampleScene() });
  let disposed = false;
  return {
    suspend: () => input.suspend(),
    resume: () => input.resume(),
    snapshot: () => ({ ...input.snapshot(), scene: sampleScene() }),
    dispose() {
      if (disposed) return;
      input.suspend();
      orbit.dispose();
      input.dispose();
      disposed = true;
    },
  };
}
