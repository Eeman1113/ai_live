import { WORLD_WIDTH, WORLD_ATMO_HEIGHT, MAX_PLANTS, SIM_HZ, YEAR_DURATION_TICKS } from './constants';

export interface SimulationConfig {
  seed: number;
  worldWidth: number;
  atmoHeight: number;
  maxPlants: number;
  simHz: number;
  yearDurationTicks: number;
  // Terrain
  terrainRoughness: number;
  basinDepth: number;
  // Climate
  baseTemperature: number;
  temperatureAmplitude: number;
  baseHumidity: number;
  windStrength: number;
  // Soil
  topsoilPorosity: number;
  subsoilPorosity: number;
  hydraulicConductivity: number;
  // Biology
  mutationRate: number;
  seedDispersalBase: number;
  decompositionRate: number;
  initialPlantCount: number;
}

export const DEFAULT_CONFIG: SimulationConfig = {
  seed: 42,
  worldWidth: WORLD_WIDTH,
  atmoHeight: WORLD_ATMO_HEIGHT,
  maxPlants: MAX_PLANTS,
  simHz: SIM_HZ,
  yearDurationTicks: YEAR_DURATION_TICKS,
  terrainRoughness: 0.6,
  basinDepth: 0.4,
  baseTemperature: 20.0,
  temperatureAmplitude: 15.0,
  baseHumidity: 0.5,
  windStrength: 5.0,
  topsoilPorosity: 0.45,
  subsoilPorosity: 0.35,
  hydraulicConductivity: 0.01,
  mutationRate: 0.02,
  seedDispersalBase: 10.0,
  decompositionRate: 0.005,
  initialPlantCount: 30,
};
