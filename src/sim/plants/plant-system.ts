import { SimulationConfig } from '../../config/defaults';
import { GENOME_LENGTH, MAX_PLANTS } from '../../config/constants';
import { RNG } from '../../core/rng';
import { createRandomGenome } from './genome';

export class PlantSystem {
  private device: GPUDevice;
  private config: SimulationConfig;

  constructor(device: GPUDevice, config: SimulationConfig) {
    this.device = device;
    this.config = config;
  }

  initializePlants(): Float32Array {
    const rng = new RNG(this.config.seed + 1000);
    const stride = 10 + GENOME_LENGTH;
    const data = new Float32Array(MAX_PLANTS * stride);
    const view = new Uint32Array(data.buffer);

    for (let i = 0; i < this.config.initialPlantCount; i++) {
      const col = Math.floor(rng.range(20, this.config.worldWidth - 20));
      const genome = createRandomGenome(rng);
      const base = i * stride;

      view[base + 0] = 1;   // alive
      view[base + 1] = col; // column
      data[base + 2] = 0;   // age
      data[base + 3] = genome[6] * 1.5; // initial biomass from seed mass
      data[base + 4] = 0.05; // initial root depth
      data[base + 5] = 0.15 + rng.float() * 0.1; // initial height
      data[base + 6] = 0.1 + rng.float() * 0.1; // initial canopy
      data[base + 7] = 0;   // water stress
      data[base + 8] = 0;   // nutrient stress
      data[base + 9] = 0;   // seed timer

      for (let g = 0; g < GENOME_LENGTH; g++) {
        data[base + 10 + g] = genome[g];
      }
    }
    return data;
  }

  // Count alive plants from CPU-readback data
  static countAlive(data: Float32Array): number {
    const stride = 10 + GENOME_LENGTH;
    const view = new Uint32Array(data.buffer);
    let count = 0;
    for (let i = 0; i < MAX_PLANTS; i++) {
      if (view[i * stride] === 1) count++;
    }
    return count;
  }
}
