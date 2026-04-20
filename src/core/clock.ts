import { SIM_DT, UI_HZ } from '../config/constants';
import { SpeedMultiplier } from './types';

export class ClockManager {
  simTick = 0;
  simAccumulator = 0;
  speed: SpeedMultiplier = SpeedMultiplier.Normal;
  private lastFrameTime = 0;
  private uiInterval: number | null = null;
  private uiCallback: (() => void) | null = null;

  get paused(): boolean {
    return this.speed === SpeedMultiplier.Paused;
  }

  setSpeed(s: SpeedMultiplier) {
    this.speed = s;
  }

  // Called each animation frame with the current timestamp
  // Returns number of sim ticks to execute this frame
  update(timestamp: number): number {
    if (this.lastFrameTime === 0) {
      this.lastFrameTime = timestamp;
      return 0;
    }

    const elapsed = Math.min((timestamp - this.lastFrameTime) / 1000, 0.1); // cap at 100ms
    this.lastFrameTime = timestamp;

    if (this.paused) return 0;

    this.simAccumulator += elapsed * this.speed;
    let ticks = 0;
    const maxTicksPerFrame = 20; // prevent spiral of death
    while (this.simAccumulator >= SIM_DT && ticks < maxTicksPerFrame) {
      this.simAccumulator -= SIM_DT;
      this.simTick++;
      ticks++;
    }
    // If we hit max, drain the rest to prevent buildup
    if (ticks >= maxTicksPerFrame) {
      this.simAccumulator = 0;
    }
    return ticks;
  }

  // Interpolation factor for smooth rendering between sim states
  get interpolation(): number {
    return this.simAccumulator / SIM_DT;
  }

  startUITick(callback: () => void) {
    this.uiCallback = callback;
    this.uiInterval = window.setInterval(callback, 1000 / UI_HZ);
  }

  stopUITick() {
    if (this.uiInterval !== null) {
      clearInterval(this.uiInterval);
      this.uiInterval = null;
    }
  }

  reset() {
    this.simTick = 0;
    this.simAccumulator = 0;
    this.lastFrameTime = 0;
  }
}
