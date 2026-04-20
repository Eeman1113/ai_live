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

const CELL_STRIDE: u32 = 6u;
const F_TEMP: u32 = 0u;
const F_HUMID: u32 = 1u;
const F_WIND_X: u32 = 2u;
const F_WIND_Y: u32 = 3u;
const F_CLOUD: u32 = 4u;
const F_PRESSURE: u32 = 5u;

@group(0) @binding(0) var<uniform> sim: SimUniforms;
@group(0) @binding(1) var<uniform> season: SeasonUniforms;
@group(0) @binding(2) var<storage, read_write> atmo: array<f32>; // in-place update after advection
@group(0) @binding(3) var<storage, read> surface_water: array<f32>; // for evaporation source

fn atmo_idx(x: u32, y: u32, field: u32) -> u32 {
  return (y * sim.world_width + x) * CELL_STRIDE + field;
}

// Saturation humidity (simplified Clausius-Clapeyron)
fn saturation_humidity(temp: f32) -> f32 {
  return 0.01 * exp(0.06 * temp);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x;
  let y = gid.y;
  if (x >= sim.world_width || y >= sim.atmo_height) { return; }

  let dt = sim.dt;
  let temp = atmo[atmo_idx(x, y, F_TEMP)];
  var humid = atmo[atmo_idx(x, y, F_HUMID)];
  var cloud = atmo[atmo_idx(x, y, F_CLOUD)];

  // Saturation check
  let sat = saturation_humidity(temp);

  // --- Evaporation from surface water (bottom cells only) ---
  if (y < 2u) {
    let sw_depth = surface_water[x * 2u];
    let evap = sw_depth * 0.005 * dt * max(0.0, 1.0 - humid / sat);
    humid += evap;
  }

  // --- Condensation: excess humidity -> cloud ---
  if (humid > sat) {
    let excess = humid - sat;
    let condensed = excess * 0.3 * dt * 20.0; // condense fraction per tick
    let actual = min(condensed, excess);
    humid -= actual;
    cloud += actual;
  }

  // --- Cloud evaporation when undersaturated ---
  if (humid < sat * 0.9 && cloud > 0.0) {
    let evap_rate = min(cloud, (sat * 0.9 - humid) * 0.1 * dt * 20.0);
    cloud -= evap_rate;
    humid += evap_rate;
  }

  // --- Cloud diffusion (spread to neighbors) ---
  let height_norm = f32(y) / f32(sim.atmo_height);

  // Clouds dissipate faster near ground
  if (y < 5u) {
    cloud *= (1.0 - 0.05 * dt);
  }

  // --- Humidity diffusion ---
  // Small vertical mixing
  humid = clamp(humid, 0.0, 1.0);
  cloud = max(0.0, cloud);

  atmo[atmo_idx(x, y, F_HUMID)] = humid;
  atmo[atmo_idx(x, y, F_CLOUD)] = cloud;
}
