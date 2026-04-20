struct Uniforms {
  view_offset: vec2f,
  view_scale: vec2f,
  world_width: f32,
  time: f32,
  _pad: vec2f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) world_pos: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> terrain: array<f32>;
@group(0) @binding(2) var<storage, read> water: array<f32>; // [depth, velocity] per col

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VertexOutput {
  let col = iid;
  let quad_vert = vid % 6u;

  let col_x = f32(col) / uniforms.world_width;
  let cw = 1.0 / uniforms.world_width;
  let surface_height = terrain[col * 3u];
  let water_depth = water[col * 2u];

  // Skip if no water
  let effective_depth = max(water_depth, 0.0) * 5.0; // visual amplification

  var x: f32;
  var y: f32;
  switch (quad_vert) {
    case 0u: { x = 0.0; y = surface_height; }
    case 1u: { x = cw;  y = surface_height; }
    case 2u: { x = 0.0; y = surface_height + effective_depth; }
    case 3u: { x = cw;  y = surface_height + effective_depth; }
    case 4u: { x = 0.0; y = surface_height + effective_depth; }
    case 5u, default: { x = cw;  y = surface_height; }
  }

  let world_x = col_x + x;

  var out: VertexOutput;
  out.position = vec4f(
    (world_x - uniforms.view_offset.x) * uniforms.view_scale.x * 2.0 - 1.0,
    (y - uniforms.view_offset.y) * uniforms.view_scale.y * 2.0 - 1.0,
    0.0, 1.0
  );
  out.uv = vec2f(col_x, effective_depth);
  out.world_pos = vec2f(world_x, y);
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  let depth = in.uv.y;
  if (depth < 0.001) { discard; }

  // Water color: blue-green, darker with depth
  let base_color = vec3f(0.15, 0.4, 0.6);
  let deep_color = vec3f(0.05, 0.15, 0.3);
  let color = mix(base_color, deep_color, clamp(depth * 2.0, 0.0, 1.0));

  // Surface highlight (foam-like)
  let surface_bright = smoothstep(0.0, 0.02, depth) * (1.0 - smoothstep(0.02, 0.05, depth));
  let highlight = vec3f(0.6, 0.8, 0.9) * surface_bright * 0.5;

  // Ripple effect
  let ripple = sin(in.world_pos.x * 80.0 + uniforms.time * 3.0) * 0.02;

  let alpha = clamp(depth * 10.0, 0.0, 0.8);
  return vec4f(color + highlight + ripple, alpha);
}
