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
const T_DROUGHT_TOL: u32 = 8u;
const T_LIFESPAN: u32 = 12u;

@group(0) @binding(0) var<uniform> sim: SimUniforms;
@group(0) @binding(1) var<storage, read_write> plants: array<f32>;
@group(0) @binding(2) var<storage, read_write> detritus: array<f32>; // per-column organic detritus

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

  let age = plants[id * PLANT_STRIDE + 2u];
  let biomass = plants[id * PLANT_STRIDE + 3u];
  let water_stress = plants[id * PLANT_STRIDE + 7u];
  let nutrient_stress = plants[id * PLANT_STRIDE + 8u];
  let col = bitcast<u32>(plants[id * PLANT_STRIDE + 1u]);

  let drought_tol = plants[id * PLANT_STRIDE + GENOME_OFFSET + T_DROUGHT_TOL];
  let lifespan_bias = plants[id * PLANT_STRIDE + GENOME_OFFSET + T_LIFESPAN];

  // Base lifespan in ticks (roughly 5000 ticks * lifespan_bias)
  let max_age = 5000.0 * lifespan_bias;

  var should_die = false;

  // Age death
  if (age > max_age) {
    let death_chance = (age - max_age) / (max_age * 0.2);
    let rng = random_float(sim.tick * 17u + id * 31u);
    if (rng < death_chance * sim.dt) {
      should_die = true;
    }
  }

  // Drought death: sustained water stress exceeding tolerance
  if (water_stress > drought_tol + 0.2) {
    let excess_stress = water_stress - drought_tol;
    let death_prob = excess_stress * 0.01 * sim.dt;
    let rng = random_float(sim.tick * 23u + id * 41u);
    if (rng < death_prob) {
      should_die = true;
    }
  }

  // Starvation: biomass too low
  if (biomass < 0.01) {
    should_die = true;
  }

  // Nutrient stress death (less common)
  if (nutrient_stress > 0.9) {
    let rng = random_float(sim.tick * 37u + id * 53u);
    if (rng < 0.001 * sim.dt) {
      should_die = true;
    }
  }

  if (should_die) {
    // Mark dead
    plants[id * PLANT_STRIDE] = bitcast<f32>(0u);

    // Add biomass to detritus at this column
    if (col < sim.world_width) {
      detritus[col] += biomass;
    }

    // Clear plant data
    for (var f = 1u; f < PLANT_STRIDE; f++) {
      plants[id * PLANT_STRIDE + f] = 0.0;
    }
  }
}
