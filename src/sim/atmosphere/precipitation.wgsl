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

const CELL_STRIDE: u32 = 6u;
const F_CLOUD: u32 = 4u;
const F_WIND_Y: u32 = 3u;

@group(0) @binding(0) var<uniform> sim: SimUniforms;
@group(0) @binding(1) var<storage, read_write> atmo: array<f32>;
@group(0) @binding(2) var<storage, read_write> precip_out: array<f32>; // per-column rain accumulation

fn atmo_idx(x: u32, y: u32, field: u32) -> u32 {
  return (y * sim.world_width + x) * CELL_STRIDE + field;
}

// Simple hash for pseudo-random threshold
fn hash_u32(x: u32) -> f32 {
  var h = x;
  h = h ^ (h >> 16u);
  h = h * 0x45d9f3bu;
  h = h ^ (h >> 16u);
  return f32(h & 0xFFFFu) / 65535.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let col = gid.x;
  if (col >= sim.world_width) { return; }

  let dt = sim.dt;

  // Scan column from top to bottom, accumulate rain
  var rain_accumulator = 0.0;

  for (var y = sim.atmo_height - 1u; y > 0u; y--) {
    let cloud = atmo[atmo_idx(col, y, F_CLOUD)];
    let updraft = atmo[atmo_idx(col, y, F_WIND_Y)];

    // Rain threshold: needs sufficient cloud mass and weak updraft
    let threshold = 0.3;
    if (cloud > threshold && updraft < 2.0) {
      // Rain rate proportional to excess cloud
      let excess = cloud - threshold;
      let rain_rate = excess * 0.1 * dt;

      // Stochastic element using tick and position
      let noise = hash_u32(sim.tick * 317u + col * 7919u + y * 131u);
      let actual_rain = rain_rate * step(0.3, noise);

      rain_accumulator += actual_rain;

      // Remove rained water from cloud
      atmo[atmo_idx(col, y, F_CLOUD)] -= actual_rain;
    }

    // Rain from above falls through, some re-evaporates
    rain_accumulator *= 0.98; // slight evaporation during fall
  }

  // Output accumulated precipitation for this column
  precip_out[col] = rain_accumulator;
}
