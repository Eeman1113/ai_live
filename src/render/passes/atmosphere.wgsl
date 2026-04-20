struct Uniforms {
  view_offset: vec2f,
  view_scale: vec2f,
  world_width: f32,
  time: f32,
  _pad: vec2f,
}

struct SeasonData {
  day_of_year: f32,
  solar_angle: f32,
  day_length: f32,
  base_temp: f32,
  solar_intensity: f32,
  rain_probability: f32,
  _pad0: f32,
  _pad1: f32,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

const ATMO_CELL_STRIDE: u32 = 6u;
const F_TEMP: u32 = 0u;
const F_HUMID: u32 = 1u;
const F_WIND_X: u32 = 2u;
const F_WIND_Y: u32 = 3u;
const F_CLOUD: u32 = 4u;

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> atmo: array<f32>;
@group(0) @binding(2) var<uniform> season: SeasonData;

fn atmo_idx(x: u32, y: u32, field: u32, w: u32) -> u32 {
  return (y * w + x) * ATMO_CELL_STRIDE + field;
}

fn hash21(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.x, p.y, p.x) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

@vertex
fn vs_main(@builtin(vertex_index) idx: u32) -> VertexOutput {
  var out: VertexOutput;
  let x = f32(i32(idx) / 2) * 4.0 - 1.0;
  let y = f32(i32(idx) % 2) * 4.0 - 1.0;
  out.position = vec4f(x, y, 0.0, 1.0);
  out.uv = vec2f((x + 1.0) * 0.5, (1.0 - y) * 0.5);
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  let uv = in.uv;
  let w = u32(uniforms.world_width);
  let h = 64u; // atmo height

  // Map UV to world coordinates
  let world_x = uv.x * uniforms.view_scale.x + uniforms.view_offset.x;
  let world_y = (1.0 - uv.y) * uniforms.view_scale.y + uniforms.view_offset.y;

  // Only render atmosphere (upper half of view typically)
  // The atmosphere starts above terrain, roughly y > 0.5
  let atmo_start = 0.45;
  if (world_y < atmo_start) {
    discard;
  }

  let atmo_y_norm = (world_y - atmo_start) / (1.0 - atmo_start);
  let col = u32(clamp(world_x * f32(w), 0.0, f32(w - 1u)));
  let row = u32(clamp(atmo_y_norm * f32(h), 0.0, f32(h - 1u)));

  // Sample atmosphere data
  let cloud_density = atmo[atmo_idx(col, row, F_CLOUD, w)];
  let humidity = atmo[atmo_idx(col, row, F_HUMID, w)];
  let temperature = atmo[atmo_idx(col, row, F_TEMP, w)];

  // Sky gradient
  let sky_top = vec3f(0.1, 0.2, 0.5);    // deep blue
  let sky_bottom = vec3f(0.5, 0.65, 0.85); // light blue near horizon
  let sunset_color = vec3f(0.8, 0.4, 0.2);

  var sky = mix(sky_bottom, sky_top, atmo_y_norm);

  // Sunset/sunrise tint based on solar angle
  let solar = season.solar_angle;
  if (solar < 0.3) {
    let t = 1.0 - solar / 0.3;
    sky = mix(sky, sunset_color, t * 0.4 * (1.0 - atmo_y_norm));
  }

  // Night darkening
  let night_factor = clamp(solar * 2.0, 0.2, 1.0);
  sky *= night_factor;

  // Cloud rendering
  var cloud_color = vec3f(0.9, 0.92, 0.95); // white clouds
  let cloud_shadow = vec3f(0.4, 0.42, 0.5); // dark undersides
  let cloud_base_color = mix(cloud_shadow, cloud_color, atmo_y_norm * 0.5 + 0.5);

  // Cloud opacity with soft edges
  let cloud_alpha = smoothstep(0.0, 0.15, cloud_density) * 0.9;

  // Add some volumetric feel with noise-like variation
  let noise_pos = vec2f(f32(col) * 0.1 + uniforms.time * 0.2, f32(row) * 0.2);
  let detail = hash21(noise_pos) * 0.1;

  let final_cloud_alpha = clamp(cloud_alpha + detail * cloud_alpha, 0.0, 0.95);

  // Composite sky + clouds
  var color = mix(sky, cloud_base_color, final_cloud_alpha);

  // Humidity haze near ground
  let haze = humidity * 0.15 * (1.0 - atmo_y_norm);
  color = mix(color, vec3f(0.7, 0.75, 0.8), haze);

  // Atmospheric fade at edges
  let fade = smoothstep(0.0, 0.05, atmo_y_norm) * smoothstep(1.0, 0.95, atmo_y_norm);

  return vec4f(color, fade * 0.95);
}
