struct Uniforms {
  view_offset: vec2f,
  view_scale: vec2f,
  world_width: f32,
  time: f32,
  _pad: vec2f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) local_uv: vec2f,
  @location(1) @interpolate(flat) plant_id: u32,
  @location(2) color: vec3f,
}

const PLANT_STRIDE: u32 = 26u;
const GENOME_OFFSET: u32 = 10u;

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> plants: array<f32>;
@group(0) @binding(2) var<storage, read> terrain: array<f32>;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VertexOutput {
  var out: VertexOutput;
  out.plant_id = iid;

  let alive = bitcast<u32>(plants[iid * PLANT_STRIDE]);
  if (alive == 0u) {
    out.position = vec4f(0.0, 0.0, -2.0, 1.0);
    out.local_uv = vec2f(0.0);
    out.color = vec3f(0.0);
    return out;
  }

  let col = bitcast<u32>(plants[iid * PLANT_STRIDE + 1u]);
  if (col >= u32(uniforms.world_width)) {
    out.position = vec4f(0.0, 0.0, -2.0, 1.0);
    out.local_uv = vec2f(0.0);
    out.color = vec3f(0.0);
    return out;
  }

  let plant_height = plants[iid * PLANT_STRIDE + 5u];
  let canopy_width = plants[iid * PLANT_STRIDE + 6u];
  let water_stress = plants[iid * PLANT_STRIDE + 7u];

  let leaf_density = plants[iid * PLANT_STRIDE + GENOME_OFFSET + 3u];
  let drought_tol = plants[iid * PLANT_STRIDE + GENOME_OFFSET + 8u];
  let growth_rate = plants[iid * PLANT_STRIDE + GENOME_OFFSET + 0u];

  let terrain_height = terrain[col * 3u];
  let base_x = f32(col) / uniforms.world_width;
  let base_y = terrain_height;

  let cw = max(canopy_width / uniforms.world_width * 3.0, 0.002);
  let quad_vert = vid % 6u;

  var lx: f32;
  var ly: f32;
  switch (quad_vert) {
    case 0u: { lx = -cw; ly = 0.0; }
    case 1u: { lx = cw;  ly = 0.0; }
    case 2u: { lx = -cw; ly = plant_height * 0.15; }
    case 3u: { lx = cw;  ly = plant_height * 0.15; }
    case 4u: { lx = -cw; ly = plant_height * 0.15; }
    case 5u, default: { lx = cw;  ly = 0.0; }
  }

  let sway = sin(uniforms.time * 2.0 + f32(col) * 0.5) * 0.002 * plant_height;

  let world_x = base_x + lx + sway;
  let world_y = base_y + ly;

  out.position = vec4f(
    (world_x - uniforms.view_offset.x) * uniforms.view_scale.x * 2.0 - 1.0,
    (world_y - uniforms.view_offset.y) * uniforms.view_scale.y * 2.0 - 1.0,
    0.0, 1.0
  );

  let safe_height = max(plant_height * 0.15, 0.001);
  out.local_uv = vec2f((lx / cw + 1.0) * 0.5, ly / safe_height);

  let green = vec3f(0.2, 0.6, 0.15);
  let drought_yellow = vec3f(0.5, 0.5, 0.1);
  let lush = vec3f(0.1, 0.7, 0.2);
  var base_color = mix(green, lush, clamp(leaf_density, 0.0, 1.0));
  base_color = mix(base_color, drought_yellow, clamp(water_stress * 0.8, 0.0, 1.0));
  base_color.r += (growth_rate - 1.0) * 0.05;
  base_color.b += (drought_tol - 0.5) * 0.1;
  out.color = clamp(base_color, vec3f(0.0), vec3f(1.0));

  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  let alive = bitcast<u32>(plants[in.plant_id * PLANT_STRIDE]);
  if (alive == 0u) { discard; }

  let uv = in.local_uv;

  let trunk_width = 0.08;
  let is_trunk = step(abs(uv.x - 0.5), trunk_width) * step(uv.y, 0.0);

  let cx = (uv.x - 0.5) * 2.0;
  let cy = (uv.y - 0.6) * 2.5;
  let canopy_dist = cx * cx + cy * cy;

  if (canopy_dist > 1.0 && is_trunk < 0.5) { discard; }

  var color: vec3f;
  if (is_trunk > 0.5) {
    color = vec3f(0.3, 0.2, 0.1);
  } else {
    color = in.color;
    color *= (1.0 - canopy_dist * 0.3);
    color += vec3f(0.05, 0.1, 0.02) * (1.0 - canopy_dist);
  }

  return vec4f(color, 1.0);
}
