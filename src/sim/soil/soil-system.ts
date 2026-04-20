import { SimulationConfig } from '../../config/defaults';

export class SoilSystem {
  private device: GPUDevice;
  private config: SimulationConfig;

  constructor(device: GPUDevice, config: SimulationConfig) {
    this.device = device;
    this.config = config;
  }

  initializeSoil(): Float32Array {
    const w = this.config.worldWidth;
    const data = new Float32Array(w * 18);
    for (let x = 0; x < w; x++) {
      for (let layer = 0; layer < 3; layer++) {
        const base = x * 18 + layer * 6;
        // Deeper layers start wetter
        const baseMoisture = 0.15 + layer * 0.08;
        data[base + 0] = baseMoisture + Math.random() * 0.05; // water
        data[base + 1] = 0.3 - layer * 0.08;  // N (more in topsoil)
        data[base + 2] = 0.2 - layer * 0.05;  // P
        data[base + 3] = 0.25 - layer * 0.05; // K
        data[base + 4] = 0.15 - layer * 0.04; // organic matter
        data[base + 5] = this.config.baseTemperature + layer * 2; // temp (warmer at depth)
      }
    }
    return data;
  }
}
