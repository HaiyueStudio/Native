import {
  CartesianTransform3D, DirectionalLight, Entity, EnvironmentLight,
  HaiyueEngine, Mesh3D, PbrMaterial, createBox3D,
} from '@haiyue/engine';

/** Shared by the native app and browser reference; all colors use Engine semantics. */
export const sceneConfig = {
  box: { width: 2, height: 2, depth: 2 },
  baseColor: [0.82, 0.4, 0.18, 1] as [number, number, number, number],
  metallic: 0.35,
  roughness: 0.28,
  camera: {
    camera3D: { type: 'perspective' as const, fov: Math.PI / 3, near: 0.1, far: 100 },
    orbit: { radius: 6, theta: Math.PI / 4, phi: Math.PI / 3, target: [0, 0, 0] as [number, number, number] },
  },
  sun: { direction: [0.7, -0.4, 0.7] as [number, number, number], color: [1, 0.94, 0.82] as [number, number, number], intensity: 0.25, castShadow: false },
  environment: { intensity: 0.65 },
};

export async function preparePbrScene(engine: HaiyueEngine, roughness = sceneConfig.roughness) {
  const scene = engine.createScene({
    name: 'Native PBR copper cube', camera: sceneConfig.camera,
    render3D: { renderProfile: 'simple' }, render2D: false, gui: false,
    view: { clearColor: engine.clearColor },
  });
  const material = new PbrMaterial({ baseColor: sceneConfig.baseColor, metallic: sceneConfig.metallic, roughness });
  const cube = new Entity('Static copper cube');
  cube.addComponent(new CartesianTransform3D({ position: [0, 0, 0] }));
  cube.addComponent(new Mesh3D(createBox3D(sceneConfig.box), material));
  scene.add(cube);
  const sun = new Entity('Fixed sun');
  sun.addComponent(new DirectionalLight(sceneConfig.sun));
  scene.add(sun);
  const environment = new Entity('Analytic environment fill');
  environment.addComponent(new EnvironmentLight(sceneConfig.environment));
  scene.add(environment);
  engine.switchScene(scene);
  return { config: { ...sceneConfig, roughness }, materialType: material.type, depthFormat: engine.getDepthFormat(), alphaMode: material.alphaMode };
}
