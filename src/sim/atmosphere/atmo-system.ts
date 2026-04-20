import { SimulationConfig } from '../../config/defaults';

export class AtmoSystem {
  private device: GPUDevice;
  private config: SimulationConfig;

  constructor(device: GPUDevice, config: SimulationConfig) {
    this.device = device;
    this.config = config;
  }

  initializeAtmosphere(): Float32Array {
    const w = this.config.worldWidth;
    const h = this.config.atmoHeight;
    // 6 floats per cell: temp, humidity, wind_x, wind_y, cloud, pressure
    const data = new Float32Array(w * h * 6);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 6;
        const heightNorm = y / h;
        // Temperature: lapse rate with altitude
        data[idx + 0] = this.config.baseTemperature - heightNorm * 25;
        // Humidity: decreases with altitude
        data[idx + 1] = this.config.baseHumidity * (1 - heightNorm * 0.7);
        // Wind: gentle baseline
        data[idx + 2] = (Math.sin(x * 0.05) + Math.cos(y * 0.1)) * 0.5;
        data[idx + 3] = 0; // vertical wind starts calm
        // Clouds: none initially, will form naturally
        data[idx + 4] = 0;
        // Pressure: decreases with altitude (barometric)
        data[idx + 5] = 1.0 - heightNorm * 0.3;
      }
    }
    return data;
  }
}
