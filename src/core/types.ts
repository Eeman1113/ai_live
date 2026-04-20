import { GENOME_LENGTH } from '../config/constants';

export interface TerrainColumn {
  surfaceHeight: number;   // normalized 0..1
  bedrockDepth: number;    // depth below surface
  slope: number;           // gradient magnitude
}

export interface SoilLayer {
  waterContent: number;    // 0..1 saturation
  nutrientsN: number;
  nutrientsP: number;
  nutrientsK: number;
  organicMatter: number;
  temperature: number;
}

export interface AtmoCell {
  temperature: number;
  humidity: number;
  windX: number;
  windY: number;
  cloudDensity: number;
  pressure: number;
}

export interface PlantData {
  alive: number;
  column: number;
  age: number;
  biomass: number;
  rootDepth: number;
  height: number;
  canopyWidth: number;
  waterStress: number;
  nutrientStress: number;
  seedTimer: number;
  genome: number[];  // length GENOME_LENGTH
}

// Buffer sizes in bytes (f32 = 4 bytes, u32 = 4 bytes)
export const TERRAIN_STRIDE = 3 * 4;        // 3 floats per column
export const SOIL_LAYER_STRIDE = 6 * 4;     // 6 floats per layer
export const SOIL_STRIDE = 3 * 6 * 4;       // 3 layers x 6 floats
export const ATMO_STRIDE = 6 * 4;           // 6 floats per cell
export const PLANT_STRIDE = (10 + GENOME_LENGTH) * 4; // 10 fields + genome

export interface SimulationMetrics {
  tick: number;
  dayOfYear: number;
  season: string;
  rainfallRate: number;
  meanSoilMoisture: [number, number, number];
  groundwaterDepth: number;
  totalBiomass: number;
  plantCount: number;
  births: number;
  deaths: number;
  meanTemperature: number;
  meanHumidity: number;
  cloudCover: number;
}

export interface SpeciesSignature {
  centroid: number[];  // genome centroid
  count: number;
  meanHeight: number;
  color: [number, number, number];
}

export enum DebugLayerId {
  None = 0,
  SoilMoisture,
  Groundwater,
  WindVectors,
  CloudDensity,
  LightAvailability,
  RootCompetition,
  Temperature,
  Nutrients,
  SpeciesDistribution,
}

export enum SpeedMultiplier {
  Paused = 0,
  Quarter = 0.25,
  Normal = 1,
  Fast = 4,
  Ultra = 16,
}
