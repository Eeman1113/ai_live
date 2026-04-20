import { RNG } from '../../core/rng';
import { WORLD_WIDTH } from '../../config/constants';
import { SimulationConfig } from '../../config/defaults';

export interface TerrainData {
  heights: Float32Array;    // surface height per column (0..1)
  bedrock: Float32Array;    // bedrock depth below surface
  slopes: Float32Array;     // computed slope between neighbors
}

export function generateTerrain(config: SimulationConfig): TerrainData {
  const rng = new RNG(config.seed);
  const w = config.worldWidth;
  const heights = new Float32Array(w);
  const bedrock = new Float32Array(w);
  const slopes = new Float32Array(w);

  // Generate basin shape with fractal noise
  // Start with broad U-shape, add detail
  for (let x = 0; x < w; x++) {
    const nx = x / w; // normalized position
    // Basin shape: higher at edges, lower in center
    const basin = config.basinDepth * (4 * (nx - 0.5) * (nx - 0.5));
    heights[x] = basin;
  }

  // Add multi-octave noise
  const octaves = 5;
  let amplitude = config.terrainRoughness * 0.3;
  let frequency = 4;
  for (let oct = 0; oct < octaves; oct++) {
    const phase = rng.float() * 1000;
    for (let x = 0; x < w; x++) {
      const nx = x / w;
      // Simple coherent noise using sin of different frequencies
      const n = Math.sin((nx * frequency + phase) * Math.PI * 2)
        * Math.cos((nx * frequency * 1.7 + phase * 0.3) * Math.PI * 2);
      heights[x] += n * amplitude;
    }
    amplitude *= 0.5;
    frequency *= 2.1;
  }

  // Add some random bumps
  const numBumps = 5 + Math.floor(rng.float() * 10);
  for (let i = 0; i < numBumps; i++) {
    const cx = rng.float();
    const width = rng.range(0.02, 0.1);
    const height = rng.range(-0.1, 0.15);
    for (let x = 0; x < w; x++) {
      const nx = x / w;
      const d = (nx - cx) / width;
      heights[x] += height * Math.exp(-d * d);
    }
  }

  // Normalize to 0.2..0.7 range (leave room for water above and soil below)
  let min = Infinity, max = -Infinity;
  for (let x = 0; x < w; x++) {
    min = Math.min(min, heights[x]);
    max = Math.max(max, heights[x]);
  }
  const range = max - min || 1;
  for (let x = 0; x < w; x++) {
    heights[x] = 0.2 + ((heights[x] - min) / range) * 0.5;
  }

  // Bedrock depth (deeper in center of basin)
  for (let x = 0; x < w; x++) {
    const nx = x / w;
    const centerDist = Math.abs(nx - 0.5) * 2;
    bedrock[x] = 0.15 + 0.1 * (1 - centerDist) + rng.range(-0.02, 0.02);
  }

  // Compute slopes
  for (let x = 1; x < w - 1; x++) {
    slopes[x] = (heights[x + 1] - heights[x - 1]) * 0.5 * w;
  }
  slopes[0] = slopes[1];
  slopes[w - 1] = slopes[w - 2];

  return { heights, bedrock, slopes };
}

// Pack terrain data into GPU buffer format: [height, bedrock, slope] per column
export function packTerrainBuffer(terrain: TerrainData): Float32Array {
  const w = terrain.heights.length;
  const packed = new Float32Array(w * 3);
  for (let x = 0; x < w; x++) {
    packed[x * 3 + 0] = terrain.heights[x];
    packed[x * 3 + 1] = terrain.bedrock[x];
    packed[x * 3 + 2] = terrain.slopes[x];
  }
  return packed;
}
