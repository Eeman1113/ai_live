import { ClockManager } from './clock';
import { SimManager } from '../sim/sim-manager';
import { Renderer } from '../render/renderer';
import { GPUContext } from '../gpu/device';
import { SimulationConfig } from '../config/defaults';
import { SpeedMultiplier } from './types';

export class MainLoop {
  private clock: ClockManager;
  private sim: SimManager;
  private renderer: Renderer;
  private running = false;
  private animFrameId = 0;

  // Public state for UI
  currentTick = 0;
  fps = 0;
  private frameCount = 0;
  private fpsTimer = 0;

  constructor(gpu: GPUContext, config: SimulationConfig) {
    this.clock = new ClockManager();
    this.sim = new SimManager(gpu, config);
    this.renderer = new Renderer(gpu, this.sim);
  }

  async init() {
    await this.sim.init();
    this.renderer.init();
  }

  start() {
    this.running = true;
    this.loop(performance.now());
  }

  stop() {
    this.running = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.clock.stopUITick();
  }

  private loop = (timestamp: number) => {
    if (!this.running) return;

    // Update clock, get number of sim ticks needed
    const ticks = this.clock.update(timestamp);

    // Execute simulation steps
    for (let i = 0; i < ticks; i++) {
      this.sim.step();
    }
    this.currentTick = this.sim.getTick();

    // Render
    const dt = 1 / 60; // approximate
    this.renderer.render(dt);

    // FPS tracking
    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 1.0) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  setSpeed(speed: SpeedMultiplier) {
    this.clock.setSpeed(speed);
  }

  getSpeed(): SpeedMultiplier {
    return this.clock.speed;
  }

  getRenderer(): Renderer {
    return this.renderer;
  }

  getClock(): ClockManager {
    return this.clock;
  }

  resize(width: number, height: number) {
    this.renderer.resize(width, height);
  }
}
