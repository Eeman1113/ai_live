import { writeSeasonUniforms } from '../../gpu/uniforms';
import { SimulationConfig } from '../../config/defaults';

export class SeasonSystem {
  private device: GPUDevice;
  private config: SimulationConfig;
  private uniformBuffer: GPUBuffer;

  constructor(device: GPUDevice, config: SimulationConfig, uniformBuffer: GPUBuffer) {
    this.device = device;
    this.config = config;
    this.uniformBuffer = uniformBuffer;
  }

  update(tick: number) {
    writeSeasonUniforms(
      this.device,
      this.uniformBuffer,
      tick,
      this.config.yearDurationTicks,
      this.config.baseTemperature,
      this.config.temperatureAmplitude
    );
  }

  getSeasonName(tick: number): string {
    const progress = (tick % this.config.yearDurationTicks) / this.config.yearDurationTicks;
    if (progress < 0.25) return 'Winter';
    if (progress < 0.5) return 'Spring';
    if (progress < 0.75) return 'Summer';
    return 'Autumn';
  }

  getDayOfYear(tick: number): number {
    const progress = (tick % this.config.yearDurationTicks) / this.config.yearDurationTicks;
    return Math.floor(progress * 365);
  }
}
