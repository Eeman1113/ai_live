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

struct TerrainColumn {
  height: f32,
  bedrock_depth: f32,
  slope: f32,
}

@group(0) @binding(0) var<uniform> sim: SimUniforms;
@group(0) @binding(1) var<storage, read> terrain: array<TerrainColumn>;
@group(0) @binding(2) var<storage, read> water_in: array<f32>;   // [depth, velocity] per column
@group(0) @binding(3) var<storage, read_write> water_out: array<f32>;
@group(0) @binding(4) var<storage, read> precipitation: array<f32>; // rain input per column

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let col = gid.x;
  if (col >= sim.world_width) { return; }

  let dt = sim.dt;
  let w = sim.world_width;

  let depth = water_in[col * 2u];
  let velocity = water_in[col * 2u + 1u];
  let rain = precipitation[col];

  // Add rainfall
  var new_depth = depth + rain * dt;

  // Shallow water flow: flux based on water surface gradient
  var flux_out = 0.0;
  var flux_in = 0.0;

  let surface_height = terrain[col].height + new_depth;

  if (col > 0u) {
    let left_surface = terrain[col - 1u].height + water_in[(col - 1u) * 2u];
    let diff = surface_height - left_surface;
    if (diff > 0.0) {
      flux_out += diff * 0.3 * dt;
    } else {
      flux_in += (-diff) * 0.3 * dt;
    }
  }

  if (col < w - 1u) {
    let right_surface = terrain[col + 1u].height + water_in[(col + 1u) * 2u];
    let diff = surface_height - right_surface;
    if (diff > 0.0) {
      flux_out += diff * 0.3 * dt;
    } else {
      flux_in += (-diff) * 0.3 * dt;
    }
  }

  // Net flow
  new_depth = new_depth - flux_out + flux_in;

  // Evaporation (basic)
  let evap = new_depth * 0.001 * dt;
  new_depth -= evap;

  // Edge drain (basin outflow at boundaries)
  if (col == 0u || col == w - 1u) {
    new_depth *= 0.95; // slow drain at edges
  }

  new_depth = max(0.0, new_depth);

  // Update velocity (momentum from slope)
  let new_velocity = terrain[col].slope * -0.1 + velocity * 0.9;

  water_out[col * 2u] = new_depth;
  water_out[col * 2u + 1u] = new_velocity;
}
