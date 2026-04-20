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

// Per atmo cell: temp, humidity, wind_x, wind_y, cloud_density, pressure
const CELL_STRIDE: u32 = 6u;
const F_TEMP: u32 = 0u;
const F_HUMID: u32 = 1u;
const F_WIND_X: u32 = 2u;
const F_WIND_Y: u32 = 3u;
const F_CLOUD: u32 = 4u;
const F_PRESSURE: u32 = 5u;

@group(0) @binding(0) var<uniform> sim: SimUniforms;
@group(0) @binding(1) var<uniform> season: SeasonUniforms;
@group(0) @binding(2) var<storage, read> atmo_in: array<f32>;
@group(0) @binding(3) var<storage, read_write> atmo_out: array<f32>;
@group(0) @binding(4) var<storage, read> terrain: array<f32>; // terrain heights for boundary

fn atmo_idx(x: u32, y: u32, field: u32) -> u32 {
  return (y * sim.world_width + x) * CELL_STRIDE + field;
}

fn sample_field(x: i32, y: i32, field: u32) -> f32 {
  let cx = clamp(u32(x), 0u, sim.world_width - 1u);
  let cy = clamp(u32(y), 0u, sim.atmo_height - 1u);
  return atmo_in[atmo_idx(cx, cy, field)];
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x;
  let y = gid.y;
  if (x >= sim.world_width || y >= sim.atmo_height) { return; }

  let dt = sim.dt;
  let ix = i32(x);
  let iy = i32(y);

  // Read current state
  let temp = atmo_in[atmo_idx(x, y, F_TEMP)];
  let humid = atmo_in[atmo_idx(x, y, F_HUMID)];
  let wind_x = atmo_in[atmo_idx(x, y, F_WIND_X)];
  let wind_y = atmo_in[atmo_idx(x, y, F_WIND_Y)];
  let cloud = atmo_in[atmo_idx(x, y, F_CLOUD)];
  let pressure = atmo_in[atmo_idx(x, y, F_PRESSURE)];

  // --- Temperature advection ---
  // Semi-Lagrangian: trace back along velocity
  let back_x = f32(ix) - wind_x * dt * 2.0;
  let back_y = f32(iy) - wind_y * dt * 2.0;
  let bxi = i32(floor(back_x));
  let byi = i32(floor(back_y));
  let fx = back_x - floor(back_x);
  let fy = back_y - floor(back_y);

  // Bilinear interpolation of temperature
  let t00 = sample_field(bxi, byi, F_TEMP);
  let t10 = sample_field(bxi + 1, byi, F_TEMP);
  let t01 = sample_field(bxi, byi + 1, F_TEMP);
  let t11 = sample_field(bxi + 1, byi + 1, F_TEMP);
  var new_temp = mix(mix(t00, t10, fx), mix(t01, t11, fx), fy);

  // Solar heating at ground level
  let height_norm = f32(y) / f32(sim.atmo_height);
  if (y < 3u) {
    new_temp += season.solar_intensity * 0.00002 * dt * (1.0 - height_norm);
  }

  // Adiabatic cooling with altitude
  new_temp -= height_norm * 0.5 * dt;

  // Radiative cooling (all cells)
  new_temp -= 0.01 * dt;

  // Relaxation toward seasonal baseline
  new_temp = mix(new_temp, season.base_temp - height_norm * 20.0, 0.001 * dt);

  // --- Humidity advection ---
  let h00 = sample_field(bxi, byi, F_HUMID);
  let h10 = sample_field(bxi + 1, byi, F_HUMID);
  let h01 = sample_field(bxi, byi + 1, F_HUMID);
  let h11 = sample_field(bxi + 1, byi + 1, F_HUMID);
  var new_humid = mix(mix(h00, h10, fx), mix(h01, h11, fx), fy);

  // --- Wind from pressure gradient and buoyancy ---
  let p_left = sample_field(ix - 1, iy, F_PRESSURE);
  let p_right = sample_field(ix + 1, iy, F_PRESSURE);
  let p_down = sample_field(ix, iy - 1, F_PRESSURE);
  let p_up = sample_field(ix, iy + 1, F_PRESSURE);

  var new_wind_x = wind_x * 0.98; // friction
  var new_wind_y = wind_y * 0.98;

  // Pressure gradient force
  new_wind_x += (p_left - p_right) * 0.5 * dt;
  new_wind_y += (p_down - p_up) * 0.5 * dt;

  // Buoyancy: warm air rises
  let temp_above = sample_field(ix, iy + 1, F_TEMP);
  let buoyancy = (new_temp - temp_above) * 0.01 * dt;
  new_wind_y += buoyancy;

  // Gentle prevailing wind
  new_wind_x += sin(season.day_of_year * 6.28) * 0.01 * dt;

  // --- Pressure from temperature (ideal gas approximation) ---
  let new_pressure = new_temp / (season.base_temp + 1.0) + (1.0 - height_norm) * 0.1;

  // Write output
  atmo_out[atmo_idx(x, y, F_TEMP)] = new_temp;
  atmo_out[atmo_idx(x, y, F_HUMID)] = clamp(new_humid, 0.0, 1.0);
  atmo_out[atmo_idx(x, y, F_WIND_X)] = clamp(new_wind_x, -20.0, 20.0);
  atmo_out[atmo_idx(x, y, F_WIND_Y)] = clamp(new_wind_y, -10.0, 10.0);
  atmo_out[atmo_idx(x, y, F_CLOUD)] = cloud; // updated by moisture pass
  atmo_out[atmo_idx(x, y, F_PRESSURE)] = new_pressure;
}
