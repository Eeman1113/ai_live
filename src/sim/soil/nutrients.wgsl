struct SimUniforms {
  tick: u32,
  dt: f32,
  seed: u32,
  world_width: u32,
  atmo_height: u32,
  max_plants: u32,
  _pad0: u32,
  _pad1: u32,
}

struct SeasonUniforms {
  day_of_year: f32,
  solar_angle: f32,
  day_length: f32,
  base_temp: f32,
  solar_intensity: f32,
  rain_probability: f32,
  _pad0: f32,
  _pad1: f32,
}

@group(0) @binding(0) var<uniform> sim: SimUniforms;
@group(0) @binding(1) var<uniform> season: SeasonUniforms;
@group(0) @binding(2) var<storage, read> soil_in: array<f32>;
@group(0) @binding(3) var<storage, read_write> soil_out: array<f32>;
@group(0) @binding(4) var<storage, read> detritus: array<f32>; // per-column detritus pool

const LAYER_STRIDE: u32 = 6u;
const COLUMN_STRIDE: u32 = 18u;
const F_WATER: u32 = 0u;
const F_N: u32 = 1u;
const F_P: u32 = 2u;
const F_K: u32 = 3u;
const F_ORGANIC: u32 = 4u;
const F_TEMP: u32 = 5u;

fn soil_idx(col: u32, layer: u32, field: u32) -> u32 {
  return col * COLUMN_STRIDE + layer * LAYER_STRIDE + field;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let col = gid.x;
  if (col >= sim.world_width) { return; }

  let dt = sim.dt;
  let w = sim.world_width;

  // Copy state
  for (var layer = 0u; layer < 3u; layer++) {
    for (var f = 0u; f < LAYER_STRIDE; f++) {
      let idx = soil_idx(col, layer, f);
      soil_out[idx] = soil_in[idx];
    }
  }

  // --- Decomposition: detritus -> organic matter -> mineral nutrients ---
  let det = detritus[col];
  let moisture = soil_in[soil_idx(col, 0u, F_WATER)];
  let temp = season.base_temp;
  // Decomposition rate depends on moisture and temperature
  let temp_factor = clamp((temp - 5.0) / 30.0, 0.0, 1.0);
  let moisture_factor = clamp(moisture * 3.0, 0.0, 1.0);
  let decomp_rate = 0.005 * dt * temp_factor * moisture_factor;

  // Add to organic matter in topsoil
  let organic_add = det * decomp_rate;
  let org_idx = soil_idx(col, 0u, F_ORGANIC);
  soil_out[org_idx] += organic_add;

  // Mineralization: organic matter -> available nutrients
  let organic = soil_out[org_idx];
  let mineral_rate = 0.002 * dt * temp_factor * moisture_factor;
  let mineralized = organic * mineral_rate;
  soil_out[org_idx] -= mineralized;

  // Distribute to N, P, K (different ratios)
  soil_out[soil_idx(col, 0u, F_N)] += mineralized * 0.5;
  soil_out[soil_idx(col, 0u, F_P)] += mineralized * 0.2;
  soil_out[soil_idx(col, 0u, F_K)] += mineralized * 0.3;

  // --- Nutrient leaching (downward transport with water movement) ---
  for (var layer = 0u; layer < 2u; layer++) {
    let water = soil_in[soil_idx(col, layer, F_WATER)];
    if (water > 0.3) { // leaching only when fairly wet
      let leach_factor = (water - 0.3) * 0.01 * dt;
      for (var nut = 1u; nut <= 3u; nut++) { // N, P, K
        let upper_nut = soil_out[soil_idx(col, layer, nut)];
        let leach = upper_nut * leach_factor;
        soil_out[soil_idx(col, layer, nut)] -= leach;
        soil_out[soil_idx(col, layer + 1u, nut)] += leach;
      }
    }
  }

  // --- Lateral nutrient diffusion ---
  if (col > 0u && col < w - 1u) {
    for (var layer = 0u; layer < 3u; layer++) {
      for (var nut = 1u; nut <= 3u; nut++) {
        let center = soil_in[soil_idx(col, layer, nut)];
        let left = soil_in[soil_idx(col - 1u, layer, nut)];
        let right = soil_in[soil_idx(col + 1u, layer, nut)];
        let diff = 0.001 * dt * ((left + right) * 0.5 - center);
        soil_out[soil_idx(col, layer, nut)] += diff;
      }
    }
  }

  // --- Clamp nutrients ---
  for (var layer = 0u; layer < 3u; layer++) {
    for (var nut = 1u; nut <= 4u; nut++) { // N, P, K, Organic
      let idx = soil_idx(col, layer, nut);
      soil_out[idx] = max(0.0, soil_out[idx]);
    }
  }
}
