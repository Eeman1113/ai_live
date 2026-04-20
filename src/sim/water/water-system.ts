import { SimulationConfig } from '../../config/defaults';

export class WaterSystem {
  private device: GPUDevice;
  private config: SimulationConfig;

  constructor(device: GPUDevice, config: SimulationConfig) {
    this.device = device;
    this.config = config;
  }

  initializeSurfaceWater(): Float32Array {
    const w = this.config.worldWidth;
    // [depth, velocity] per column
    const data = new Float32Array(w * 2);
    // Start dry, let rain fill naturally
    return data;
  }
}
