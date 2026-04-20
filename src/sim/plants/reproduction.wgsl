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

const PLANT_STRIDE: u32 = 26u;
const GENOME_OFFSET: u32 = 10u;
const T_SEED_MASS: u32 = 6u;
const T_DISPERSAL: u32 = 7u;
const T_GERM_MOISTURE: u32 = 11u;

const SOIL_COLUMN_STRIDE: u32 = 18u;

@group(0) @binding(0) var<uniform> sim: SimUniforms;
@group(0) @binding(1) var<uniform> season: SeasonUniforms;
@group(0) @binding(2) var<storage, read_write> plants: array<f32>;
@group(0) @binding(3) var<storage, read> soil: array<f32>;
@group(0) @binding(4) var<storage, read> atmo: array<f32>; // for wind-based dispersal
@group(0) @binding(5) var<storage, read_write> seed_bank: array<f32>; // temporary seed storage

// Hash for randomness
fn pcg_hash(input: u32) -> u32 {
  var state = input * 747796405u + 2891336453u;
  let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

fn random_float(seed: u32) -> f32 {
  return f32(pcg_hash(seed) & 0xFFFFu) / 65535.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let id = gid.x;
  if (id >= sim.max_plants) { return; }

  let alive = bitcast<u32>(plants[id * PLANT_STRIDE]);
  if (alive == 0u) { return; }

  let seed_timer = plants[id * PLANT_STRIDE + 9u];
  let seed_threshold = 50.0; // ticks between seed production

  if (seed_timer < seed_threshold) { return; }

  // Reset seed timer
  plants[id * PLANT_STRIDE + 9u] = 0.0;

  let col = bitcast<u32>(plants[id * PLANT_STRIDE + 1u]);
  let dispersal = plants[id * PLANT_STRIDE + GENOME_OFFSET + T_DISPERSAL];
  let seed_mass = plants[id * PLANT_STRIDE + GENOME_OFFSET + T_SEED_MASS];
  let germ_moisture = plants[id * PLANT_STRIDE + GENOME_OFFSET + T_GERM_MOISTURE];

  // Get wind at plant location for dispersal direction
  let atmo_cell_stride = 6u;
  let wind_x = atmo[(0u * sim.world_width + col) * atmo_cell_stride + 2u]; // bottom cell wind

  // Produce 1-3 seeds
  let rng_base = sim.tick * 13u + id * 7u;
  let num_seeds = 1u + u32(random_float(rng_base) * 2.0);

  for (var s = 0u; s < num_seeds; s++) {
    // Calculate landing position
    let rng_seed = rng_base + s * 31u;
    let spread = (random_float(rng_seed) - 0.5) * dispersal * 2.0;
    let wind_push = wind_x * dispersal * 0.2 / max(seed_mass, 0.01);
    let target_col = i32(col) + i32(spread + wind_push);

    if (target_col < 0 || target_col >= i32(sim.world_width)) { continue; }
    let tcol = u32(target_col);

    // Check germination conditions at target
    let soil_moisture = soil[tcol * SOIL_COLUMN_STRIDE]; // topsoil water
    let temp = season.base_temp;

    if (soil_moisture < germ_moisture) { continue; }
    if (temp < 8.0 || temp > 40.0) { continue; }

    // Find a free plant slot
    for (var slot = 0u; slot < sim.max_plants; slot++) {
      let check_alive = bitcast<u32>(plants[slot * PLANT_STRIDE]);
      if (check_alive == 0u) {
        // Initialize new plant
        plants[slot * PLANT_STRIDE + 0u] = bitcast<f32>(1u); // alive
        plants[slot * PLANT_STRIDE + 1u] = bitcast<f32>(tcol); // column
        plants[slot * PLANT_STRIDE + 2u] = 0.0; // age
        plants[slot * PLANT_STRIDE + 3u] = seed_mass; // initial biomass from seed
        plants[slot * PLANT_STRIDE + 4u] = 0.05; // initial root depth
        plants[slot * PLANT_STRIDE + 5u] = 0.1; // initial height
        plants[slot * PLANT_STRIDE + 6u] = 0.1; // initial canopy
        plants[slot * PLANT_STRIDE + 7u] = 0.0; // water stress
        plants[slot * PLANT_STRIDE + 8u] = 0.0; // nutrient stress
        plants[slot * PLANT_STRIDE + 9u] = 0.0; // seed timer

        // Copy parent genome with mutation (simple perturbation)
        for (var g = 0u; g < 16u; g++) {
          var trait_val = plants[id * PLANT_STRIDE + GENOME_OFFSET + g];
          // Small mutation
          let mutation = (random_float(rng_seed + g * 17u + slot) - 0.5) * 0.04;
          trait_val += mutation;
          trait_val = clamp(trait_val, 0.05, 10.0);
          plants[slot * PLANT_STRIDE + GENOME_OFFSET + g] = trait_val;
        }
        break; // only fill one slot per seed
      }
    }
  }

  // Reduce parent biomass for seed production
  let cost = seed_mass * f32(num_seeds) * 2.0;
  plants[id * PLANT_STRIDE + 3u] -= cost;
}
