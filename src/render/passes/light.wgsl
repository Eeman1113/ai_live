// Volumetric light shaft post-process
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

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<uniform> season: SeasonData;
@group(0) @binding(2) var<storage, read> atmo: array<f32>;

const NUM_SAMPLES: i32 = 32;
const ATMO_CELL_STRIDE: u32 = 6u;
const F_CLOUD: u32 = 4u;

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

  // Sun position based on season
  let sun_x = 0.5 + sin(uniforms.time * 0.05) * 0.1;
  let sun_y = 0.1 - season.solar_angle * 0.15;
  let sun_pos = vec2f(sun_x, sun_y);

  // Ray march from pixel toward sun
  let ray_dir = normalize(sun_pos - uv);
  let step_size = 1.0 / f32(NUM_SAMPLES);

  var illumination = 0.0;
  var pos = uv;
  let decay = 0.97;
  let weight = 0.04;
  let exposure = 0.3;

  let w = u32(uniforms.world_width);
  let h = 64u;

  for (var i = 0; i < NUM_SAMPLES; i++) {
    pos += ray_dir * step_size * 0.3;

    // Sample cloud density at this position
    let sample_x = u32(clamp(pos.x * f32(w), 0.0, f32(w - 1u)));
    let sample_y = u32(clamp((1.0 - pos.y) * f32(h), 0.0, f32(h - 1u)));
    let cloud = atmo[(sample_y * w + sample_x) * ATMO_CELL_STRIDE + F_CLOUD];

    // Light is occluded by clouds
    let occlusion = 1.0 - clamp(cloud * 3.0, 0.0, 0.9);
    illumination += occlusion * weight;
    illumination *= decay;
  }

  illumination *= exposure * max(0.0, season.solar_angle);

  // God ray color (warm golden)
  let ray_color = vec3f(1.0, 0.9, 0.6) * illumination;

  // Distance falloff from sun
  let dist_to_sun = length(uv - sun_pos);
  let sun_glow = exp(-dist_to_sun * 3.0) * 0.1 * max(0.0, season.solar_angle);
  let glow_color = vec3f(1.0, 0.85, 0.5) * sun_glow;

  let final_color = ray_color + glow_color;
  let alpha = clamp(illumination * 2.0 + sun_glow, 0.0, 0.4);

  return vec4f(final_color, alpha);
}
