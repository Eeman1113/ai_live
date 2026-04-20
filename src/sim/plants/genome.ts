import { GENOME_LENGTH } from '../../config/constants';
import { RNG } from '../../core/rng';

// Genome trait indices
export const TRAIT = {
  GROWTH_RATE: 0,
  ROOT_DEPTH_BIAS: 1,
  LATERAL_ROOT_SPREAD: 2,
  LEAF_DENSITY: 3,
  BRANCHING_TENDENCY: 4,
  MAX_HEIGHT: 5,
  SEED_MASS: 6,
  DISPERSAL_COEFF: 7,
  DROUGHT_TOLERANCE: 8,
  SHADE_TOLERANCE: 9,
  NUTRIENT_EFFICIENCY: 10,
  GERMINATION_MOISTURE: 11,
  LIFESPAN_BIAS: 12,
  STEM_THICKNESS: 13,
  LEAF_SIZE: 14,
  REPRODUCTIVE_AGE: 15,
} as const;

// Each trait has a valid range [min, max]
export const TRAIT_RANGES: [number, number][] = [
  [0.1, 2.0],    // GROWTH_RATE
  [0.1, 1.0],    // ROOT_DEPTH_BIAS (fraction of available soil)
  [0.1, 0.8],    // LATERAL_ROOT_SPREAD
  [0.2, 1.0],    // LEAF_DENSITY
  [0.1, 0.9],    // BRANCHING_TENDENCY
  [0.5, 10.0],   // MAX_HEIGHT (in world units)
  [0.01, 0.2],   // SEED_MASS
  [1.0, 30.0],   // DISPERSAL_COEFF (columns of spread)
  [0.1, 0.95],   // DROUGHT_TOLERANCE
  [0.1, 0.95],   // SHADE_TOLERANCE
  [0.3, 1.0],    // NUTRIENT_EFFICIENCY
  [0.1, 0.8],    // GERMINATION_MOISTURE threshold
  [0.5, 3.0],    // LIFESPAN_BIAS (multiplier on base lifespan)
  [0.1, 0.8],    // STEM_THICKNESS
  [0.2, 1.0],    // LEAF_SIZE
  [0.1, 0.6],    // REPRODUCTIVE_AGE (fraction of lifespan)
];

export function createRandomGenome(rng: RNG): Float32Array {
  const genome = new Float32Array(GENOME_LENGTH);
  for (let i = 0; i < GENOME_LENGTH; i++) {
    const [min, max] = TRAIT_RANGES[i];
    genome[i] = rng.range(min, max);
  }
  return genome;
}

export function mutateGenome(parent: Float32Array, rng: RNG, mutationRate: number): Float32Array {
  const child = new Float32Array(GENOME_LENGTH);
  for (let i = 0; i < GENOME_LENGTH; i++) {
    const [min, max] = TRAIT_RANGES[i];
    const range = max - min;
    const perturbation = rng.gaussian(0, mutationRate * range);
    child[i] = Math.max(min, Math.min(max, parent[i] + perturbation));
  }
  return child;
}
