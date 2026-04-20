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

// Per-column terrain: height, bedrock_depth, slope
struct TerrainColumn {
  height: f32,
  bedrock_depth: f32,
  slope: f32,
}

// Per-column soil: 3 layers x 6 floats = 18 floats
// [water, N, P, K, organic, temp] x 3
struct SoilColumn {
  data: array<f32, 18>,
}

@group(0) @binding(0) var<uniform> sim: SimUniforms;
@group(0) @binding(1) var<uniform> season: SeasonUniforms;
@group(0) @binding(2) var<storage, read> terrain: array<TerrainColumn>;
@group(0) @binding(3) var<storage, read> soil_in: array<f32>;
@group(0) @binding(4) var<storage, read_write> soil_out: array<f32>;
@group(0) @binding(5) var<storage, read> surface_water: array<f32>;

const LAYER_STRIDE: u32 = 6u;
const COLUMN_STRIDE: u32 = 18u; // 3 layers x 6 floats

fn soil_idx(col: u32, layer: u32, field: u32) -> u32 {
  return col * COLUMN_STRIDE + layer * LAYER_STRIDE + field;
}

// Field indices within a layer
const F_WATER: u32 = 0u;
const F_N: u32 = 1u;
const F_P: u32 = 2u;
const F_K: u32 = 3u;
const F_ORGANIC: u32 = 4u;
const F_TEMP: u32 = 5u;

// Porosity per layer
const POROSITY: array<f32, 3> = array<f32, 3>(0.45, 0.35, 0.15);
const CONDUCTIVITY: array<f32, 3> = array<f32, 3>(0.02, 0.008, 0.001);
const FIELD_CAPACITY: array<f32, 3> = array<f32, 3>(0.3, 0.25, 0.1);

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let col = gid.x;
  if (col >= sim.world_width) { return; }

  let dt = sim.dt;
  let w = sim.world_width;

  // Copy current state to output first
  for (var layer = 0u; layer < 3u; layer++) {
    for (var f = 0u; f < LAYER_STRIDE; f++) {
      let idx = soil_idx(col, layer, f);
      soil_out[idx] = soil_in[idx];
    }
  }

  // --- Infiltration from surface water into topsoil ---
  let sw_depth = surface_water[col * 2u]; // surface water depth
  let topsoil_water = soil_in[soil_idx(col, 0u, F_WATER)];
  let available_space = max(0.0, POROSITY[0] - topsoil_water);
  let infiltration_rate = CONDUCTIVITY[0] * dt * 20.0;
  let infiltration = min(min(sw_depth * 0.5, available_space), infiltration_rate);
  soil_out[soil_idx(col, 0u, F_WATER)] = topsoil_water + infiltration;

  // --- Vertical drainage between layers ---
  for (var layer = 0u; layer < 2u; layer++) {
    let upper_water = soil_out[soil_idx(col, layer, F_WATER)];
    let lower_water = soil_in[soil_idx(col, layer + 1u, F_WATER)];
    let excess = max(0.0, upper_water - FIELD_CAPACITY[layer]);
    let lower_space = max(0.0, POROSITY[layer + 1u] - lower_water);
    let drain = min(excess, min(lower_space, CONDUCTIVITY[layer] * dt * 10.0));
    soil_out[soil_idx(col, layer, F_WATER)] -= drain;
    soil_out[soil_idx(col, layer + 1u, F_WATER)] = lower_water + drain;
  }

  // --- Lateral flow (Darcy-like diffusion between columns) ---
  if (col > 0u && col < w - 1u) {
    for (var layer = 0u; layer < 3u; layer++) {
      let center = soil_out[soil_idx(col, layer, F_WATER)];
      let left = soil_in[soil_idx(col - 1u, layer, F_WATER)];
      let right = soil_in[soil_idx(col + 1u, layer, F_WATER)];
      let diffusion = CONDUCTIVITY[layer] * dt * 5.0 * ((left + right) * 0.5 - center);
      soil_out[soil_idx(col, layer, F_WATER)] += diffusion;
    }
  }

  // --- Evaporation from topsoil ---
  let temp = season.base_temp;
  let evap_rate = max(0.0, (temp - 5.0) * 0.0001 * season.solar_intensity * 0.001 * dt);
  let current_top = soil_out[soil_idx(col, 0u, F_WATER)];
  let evap = min(current_top * 0.1, evap_rate);
  soil_out[soil_idx(col, 0u, F_WATER)] -= evap;

  // --- Capillary rise from deep to mid layer ---
  let deep_water = soil_out[soil_idx(col, 2u, F_WATER)];
  let mid_water = soil_out[soil_idx(col, 1u, F_WATER)];
  if (deep_water > FIELD_CAPACITY[2] && mid_water < FIELD_CAPACITY[1]) {
    let cap_rise = min(deep_water - FIELD_CAPACITY[2], 0.001 * dt);
    soil_out[soil_idx(col, 2u, F_WATER)] -= cap_rise;
    soil_out[soil_idx(col, 1u, F_WATER)] += cap_rise;
  }

  // --- Clamp all water values ---
  for (var layer = 0u; layer < 3u; layer++) {
    let idx = soil_idx(col, layer, F_WATER);
    soil_out[idx] = clamp(soil_out[idx], 0.0, POROSITY[layer]);
  }
}
