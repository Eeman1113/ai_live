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

// Plant struct: alive, column, age, biomass, root_depth, height, canopy_width,
// water_stress, nutrient_stress, seed_timer, genome[16] = 26 floats total
const PLANT_STRIDE: u32 = 26u;
const GENOME_OFFSET: u32 = 10u;

// Genome trait indices
const T_GROWTH_RATE: u32 = 0u;
const T_ROOT_DEPTH: u32 = 1u;
const T_LATERAL_ROOT: u32 = 2u;
const T_LEAF_DENSITY: u32 = 3u;
const T_BRANCHING: u32 = 4u;
const T_MAX_HEIGHT: u32 = 5u;
const T_SEED_MASS: u32 = 6u;
const T_DISPERSAL: u32 = 7u;
const T_DROUGHT_TOL: u32 = 8u;
const T_SHADE_TOL: u32 = 9u;
const T_NUTRIENT_EFF: u32 = 10u;
const T_GERM_MOISTURE: u32 = 11u;
const T_LIFESPAN: u32 = 12u;
const T_STEM_THICK: u32 = 13u;
const T_LEAF_SIZE: u32 = 14u;
const T_REPRO_AGE: u32 = 15u;

// Soil access
const SOIL_COLUMN_STRIDE: u32 = 18u;
const SOIL_LAYER_STRIDE: u32 = 6u;

@group(0) @binding(0) var<uniform> sim: SimUniforms;
@group(0) @binding(1) var<uniform> season: SeasonUniforms;
@group(0) @binding(2) var<storage, read_write> plants: array<f32>;
@group(0) @binding(3) var<storage, read> soil: array<f32>;
@group(0) @binding(4) var<storage, read> light_field: array<f32>; // per-column light availability

fn plant_field(id: u32, field: u32) -> u32 {
  return id * PLANT_STRIDE + field;
}

fn genome(id: u32, trait_idx: u32) -> f32 {
  return plants[id * PLANT_STRIDE + GENOME_OFFSET + trait_idx];
}

fn soil_water(col: u32, layer: u32) -> f32 {
  return soil[col * SOIL_COLUMN_STRIDE + layer * SOIL_LAYER_STRIDE];
}

fn soil_nutrient_n(col: u32, layer: u32) -> f32 {
  return soil[col * SOIL_COLUMN_STRIDE + layer * SOIL_LAYER_STRIDE + 1u];
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let id = gid.x;
  if (id >= sim.max_plants) { return; }

  let alive = bitcast<u32>(plants[plant_field(id, 0u)]);
  if (alive == 0u) { return; }

  let dt = sim.dt;
  let col = bitcast<u32>(plants[plant_field(id, 1u)]);
  if (col >= sim.world_width) { return; }

  var age = plants[plant_field(id, 2u)];
  var biomass = plants[plant_field(id, 3u)];
  var root_depth = plants[plant_field(id, 4u)];
  var height = plants[plant_field(id, 5u)];
  var canopy_width = plants[plant_field(id, 6u)];
  var water_stress = plants[plant_field(id, 7u)];
  var nutrient_stress = plants[plant_field(id, 8u)];
  var seed_timer = plants[plant_field(id, 9u)];

  // Read genome traits
  let growth_rate = genome(id, T_GROWTH_RATE);
  let root_depth_bias = genome(id, T_ROOT_DEPTH);
  let leaf_density = genome(id, T_LEAF_DENSITY);
  let max_height = genome(id, T_MAX_HEIGHT);
  let drought_tol = genome(id, T_DROUGHT_TOL);
  let shade_tol = genome(id, T_SHADE_TOL);
  let nutrient_eff = genome(id, T_NUTRIENT_EFF);
  let stem_thick = genome(id, T_STEM_THICK);
  let leaf_size = genome(id, T_LEAF_SIZE);

  // --- Resource acquisition ---
  // Water from root zone
  let root_layer = select(1u, 0u, root_depth < 0.3);
  let available_water = soil_water(col, root_layer) + soil_water(col, 0u);
  let water_need = biomass * 0.01 * (1.0 - drought_tol * 0.5);
  let water_uptake = min(available_water * 0.1, water_need);
  let water_satisfaction = select(water_uptake / water_need, 1.0, water_need < 0.001);

  // Nutrients
  let available_n = soil_nutrient_n(col, 0u) + soil_nutrient_n(col, root_layer);
  let nutrient_need = biomass * 0.005 * (1.0 - nutrient_eff * 0.3);
  let nutrient_uptake = min(available_n * 0.1, nutrient_need);
  let nutrient_satisfaction = select(nutrient_uptake / nutrient_need, 1.0, nutrient_need < 0.001);

  // Light
  let light = light_field[col];
  let light_need = leaf_density * (1.0 - shade_tol * 0.7);
  let light_satisfaction = select(min(light / light_need, 1.0), 1.0, light_need < 0.01);

  // --- Photosynthesis (carbon gain) ---
  let temp_factor = clamp((season.base_temp - 5.0) / 25.0, 0.0, 1.0);
  let resource_limit = min(min(water_satisfaction, nutrient_satisfaction), light_satisfaction);
  let photosynthesis = growth_rate * leaf_density * light * resource_limit * temp_factor * dt * 0.1;

  // --- Respiration (carbon cost) ---
  let respiration = biomass * 0.002 * dt * (1.0 + (season.base_temp - 10.0) * 0.01);

  // --- Net growth ---
  let net_carbon = photosynthesis - respiration;
  biomass = max(0.01, biomass + net_carbon);

  // --- Allocation: height, roots, canopy ---
  let height_fraction = 0.4 * (1.0 - height / max_height);
  let root_fraction = 0.3 * (1.0 - water_satisfaction);
  let canopy_fraction = 0.3 * (1.0 - light_satisfaction);

  if (net_carbon > 0.0) {
    height = min(max_height, height + net_carbon * height_fraction * 0.5);
    root_depth = min(root_depth_bias, root_depth + net_carbon * root_fraction * 0.3);
    canopy_width = min(leaf_size * 3.0, canopy_width + net_carbon * canopy_fraction * 0.2);
  }

  // --- Stress tracking ---
  water_stress = mix(water_stress, 1.0 - water_satisfaction, 0.1);
  nutrient_stress = mix(nutrient_stress, 1.0 - nutrient_satisfaction, 0.1);

  // --- Age ---
  age += dt;

  // --- Seed timer ---
  let repro_age = genome(id, T_REPRO_AGE) * genome(id, T_LIFESPAN) * 5000.0;
  if (age > repro_age && biomass > 1.0 && water_stress < 0.7) {
    seed_timer += dt;
  }

  // Write back
  plants[plant_field(id, 2u)] = age;
  plants[plant_field(id, 3u)] = biomass;
  plants[plant_field(id, 4u)] = root_depth;
  plants[plant_field(id, 5u)] = height;
  plants[plant_field(id, 6u)] = canopy_width;
  plants[plant_field(id, 7u)] = water_stress;
  plants[plant_field(id, 8u)] = nutrient_stress;
  plants[plant_field(id, 9u)] = seed_timer;
}
