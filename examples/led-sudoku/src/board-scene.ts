import { BasicMaterial, Camera3D, CartesianTransform3D, Entity, type HaiyueEngine, Mesh3D, World, createPlane3D } from '@haiyue/engine';
import { RenderIntegration } from '@haiyue/engine/experimental';
import { Render3DSystem } from '@haiyue/engine/systems';
import { paintBoard, type ViewState } from '../../../../Games/games/led-sudoku/board-painter';
import { NativeCanvasTextures } from '../../../bridge/render/canvas-textures';
export class BoardScene {
  private readonly world = new World('Native LED Sudoku');
  private readonly material = new BasicMaterial();
  private readonly textures: NativeCanvasTextures;
  private readonly surface: HTMLCanvasElement;
  private readonly update = (event: { detail: { time: number; delta: number } }) => this.world.update(event.detail.time, event.detail.delta);
  constructor(private readonly engine: HaiyueEngine) {
    this.textures = new NativeCanvasTextures(engine.device, 'rgba8unorm-srgb');
    this.surface = this.textures.createCanvas2D(1260, 1260);
    const camera = new Entity('LED camera');
    camera.addComponent(new Camera3D({ type: 'orthographic', left: -1, right: 1, top: 1, bottom: -1, near: .1, far: 20 }));
    const transform = new CartesianTransform3D({ position: [0, 4, 0] }); transform.setRotation(-Math.PI / 2, 0, 0); camera.addComponent(transform); this.world.addEntity(camera);
    const integration = new RenderIntegration(engine, { label: 'Native LED Sudoku' }); this.world.addRuntimeIntegration(integration);
    this.world.addSystem(new Render3DSystem(engine, camera, { loadOp: 'clear' }));
    const board = new Entity('LED board'); board.addComponent(new CartesianTransform3D()); board.addComponent(new Mesh3D(createPlane3D({ width: 2, height: 2, normal: 'y' }), this.material)); this.world.addEntity(board);
    integration.registerAll(this.world, () => ({ pass: 'shared' }));
    engine.on('update', this.update);
  }
  draw(state: ViewState): void { paintBoard(this.surface.getContext('2d')!, state); this.material.texture = this.textures.textureFromCanvas(this.surface, 'board'); }
  dispose(): void { this.engine.off('update', this.update); this.world.destroy(); this.textures.dispose(); }
}
