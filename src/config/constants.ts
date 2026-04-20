export const WORLD_WIDTH = 320;
export const WORLD_ATMO_HEIGHT = 64;
export const SOIL_LAYERS = 3;
export const MAX_PLANTS = 2048;
export const SIM_HZ = 20;
export const SIM_DT = 1.0 / SIM_HZ;
export const UI_HZ = 8;
export const YEAR_DURATION_TICKS = 20 * 60 * 10; // 10 real minutes = 1 year
export const WORKGROUP_SIZE = 64;
export const ATMO_WORKGROUP = [8, 8] as const;
export const GENOME_LENGTH = 16;

// Soil layer thickness (relative to total soil depth)
export const TOPSOIL_FRACTION = 0.3;
export const SUBSOIL_FRACTION = 0.5;
export const BEDROCK_FRACTION = 0.2;

// Physics
export const GRAVITY = 9.81;
export const WATER_DENSITY = 1000.0;
export const AIR_SPECIFIC_HEAT = 1005.0;
export const LATENT_HEAT_VAPORIZATION = 2260000.0;
export const STEFAN_BOLTZMANN = 5.67e-8;
