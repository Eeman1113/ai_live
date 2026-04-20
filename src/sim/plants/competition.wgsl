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

const PLANT_STRIDE: u32 = 26u;
const GENOME_OFFSET: u32 = 10u;

@group(0) @binding(0) var<uniform> sim: SimUniforms;
@group(0) @binding(1) var<storage, read> plants: array<f32>;
@group(0) @binding(2) var<storage, read_write> light_field: array<f32>; // per-column light after competition
@group(0) @binding(3) var<storage, read> atmo: array<f32>; // for cloud cover / light attenuation

const ATMO_CELL_STRIDE: u32 = 6u;
const F_CLOUD: u32 = 4u;

fn atmo_idx(x: u32, y: u32, field: u32) -> u32 {
  return (y * sim.world_width + x) * ATMO_CELL_STRIDE + field;
}

// Compute total cloud cover above a column
fn cloud_cover(col: u32) -> f32 {
  var total = 0.0;
  for (var y = 0u; y < sim.atmo_height; y++) {
    total += atmo[atmo_idx(col, y, F_CLOUD)];
  }
  return clamp(total, 0.0, 1.0);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let col = gid.x;
  if (col >= sim.world_width) { return; }

  // Start with full solar light, attenuated by clouds
  let clouds = cloud_cover(col);
  var light = 1.0 - clouds * 0.7; // clouds block up to 70% of light

  // Find all plants in this column and sort by height (simple bubble approach)
  // Since we have limited plants per column, collect them
  var plant_heights: array<f32, 16>;
  var plant_canopies: array<f32, 16>;
  var count = 0u;

  for (var i = 0u; i < sim.max_plants; i++) {
    let alive = bitcast<u32>(plants[i * PLANT_STRIDE]);
    if (alive == 0u) { continue; }
    let plant_col = bitcast<u32>(plants[i * PLANT_STRIDE + 1u]);

    // Check if plant's canopy covers this column
    let plant_x = plant_col;
    let canopy = plants[i * PLANT_STRIDE + 6u]; // canopy_width
    let half_canopy = u32(canopy * 2.0);

    if (plant_col >= col - half_canopy && plant_col <= col + half_canopy) {
      if (count < 16u) {
        plant_heights[count] = plants[i * PLANT_STRIDE + 5u]; // height
        let leaf_density = plants[i * PLANT_STRIDE + GENOME_OFFSET + 3u];
        plant_canopies[count] = canopy * leaf_density;
        count++;
      }
    }
  }

  // Sort by height descending (tallest first gets light first)
  for (var i = 0u; i < count; i++) {
    for (var j = i + 1u; j < count; j++) {
      if (plant_heights[j] > plant_heights[i]) {
        let tmp_h = plant_heights[i];
        plant_heights[i] = plant_heights[j];
        plant_heights[j] = tmp_h;
        let tmp_c = plant_canopies[i];
        plant_canopies[i] = plant_canopies[j];
        plant_canopies[j] = tmp_c;
      }
    }
  }

  // Each canopy absorbs some light
  for (var i = 0u; i < count; i++) {
    let absorption = plant_canopies[i] * 0.3;
    light = max(0.0, light - absorption);
  }

  light_field[col] = light;
}
