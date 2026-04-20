import { WORLD_WIDTH, WORLD_ATMO_HEIGHT, MAX_PLANTS, SIM_DT } from '../config/constants';

// SimUniforms layout (must match WGSL):
// tick: u32, dt: f32, seed: u32, worldWidth: u32,
// atmoHeight: u32, maxPlants: u32, _pad: u32, _pad: u32
export const SIM_UNIFORMS_SIZE = 8 * 4; // 32 bytes

export function writeSimUniforms(
  device: GPUDevice,
  buffer: GPUBuffer,
  tick: number,
  seed: number
) {
  const data = new ArrayBuffer(SIM_UNIFORMS_SIZE);
  const u32 = new Uint32Array(data);
  const f32 = new Float32Array(data);
  u32[0] = tick;
  f32[1] = SIM_DT;
  u32[2] = seed;
  u32[3] = WORLD_WIDTH;
  u32[4] = WORLD_ATMO_HEIGHT;
  u32[5] = MAX_PLANTS;
  u32[6] = 0;
  u32[7] = 0;
  device.queue.writeBuffer(buffer, 0, data);
}

// SeasonUniforms layout (must match WGSL):
// dayOfYear: f32, solarAngle: f32, dayLength: f32, baseTemp: f32,
// solarIntensity: f32, rainProbability: f32, _pad: f32, _pad: f32
export const SEASON_UNIFORMS_SIZE = 8 * 4; // 32 bytes

export function writeSeasonUniforms(
  device: GPUDevice,
  buffer: GPUBuffer,
  tick: number,
  yearDuration: number,
  baseTemp: number,
  tempAmplitude: number
) {
  const dayOfYear = (tick % yearDuration) / yearDuration; // 0..1 normalized
  const solarAngle = Math.sin(dayOfYear * 2 * Math.PI) * 0.8 + 0.5; // seasonal
  const dayLength = 0.5 + 0.2 * Math.sin(dayOfYear * 2 * Math.PI);
  const temperature = baseTemp + tempAmplitude * Math.sin(dayOfYear * 2 * Math.PI - Math.PI / 4);
  const solarIntensity = Math.max(0, solarAngle) * 1000; // W/m^2
  const rainProbability = 0.3 + 0.2 * Math.sin(dayOfYear * 2 * Math.PI + Math.PI / 2);

  const data = new Float32Array([
    dayOfYear,
    solarAngle,
    dayLength,
    temperature,
    solarIntensity,
    rainProbability,
    0, 0
  ]);
  device.queue.writeBuffer(buffer, 0, data);
}
