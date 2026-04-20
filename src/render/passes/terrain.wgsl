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
@group(0) @binding(1) var<storage, read> terrain: array<f32>; // [height, bedrock, slope] per col
@group(0) @binding(2) var<storage, read> soil: array<f32>;    // 18 floats per col

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VertexOutput {
  // Each instance is a column quad. 6 vertices per quad (2 triangles)
  let col = iid;
  let quad_vert = vid % 6u;

  let col_x = f32(col) / uniforms.world_width;
  let height = terrain[col * 3u];
  let bedrock = terrain[col * 3u + 1u];

  // Column width in normalized coords
  let cw = 1.0 / uniforms.world_width;

  // Quad from bottom (bedrock) to surface
  var x: f32;
  var y: f32;
  switch (quad_vert) {
    case 0u: { x = 0.0; y = 0.0; }                    // bottom-left
    case 1u: { x = cw;  y = 0.0; }                    // bottom-right
    case 2u: { x = 0.0; y = height; }                 // top-left
    case 3u: { x = cw;  y = height; }                 // top-right
    case 4u: { x = 0.0; y = height; }                 // top-left (second tri)
    case 5u, default: { x = cw;  y = 0.0; }           // bottom-right (second tri)
  }

  let world_x = col_x + x;
  let world_y = y;

  var out: VertexOutput;
  out.position = vec4f(
    (world_x - uniforms.view_offset.x) * uniforms.view_scale.x * 2.0 - 1.0,
    (world_y - uniforms.view_offset.y) * uniforms.view_scale.y * 2.0 - 1.0,
    0.0, 1.0
  );
  out.uv = vec2f(x / cw, y / height);
  out.world_pos = vec2f(world_x, world_y);
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  let col = u32(in.world_pos.x * uniforms.world_width);
  let col_clamped = min(col, u32(uniforms.world_width) - 1u);

  let height = terrain[col_clamped * 3u];
  let depth_norm = in.world_pos.y / height; // 0 = bottom, 1 = surface

  // Get soil moisture for this column (topsoil)
  let moisture = soil[col_clamped * 18u]; // topsoil water content

  // Layer colors
  // Bedrock: dark grey-brown
  let bedrock_color = vec3f(0.25, 0.2, 0.15);
  // Subsoil: brown-orange
  let subsoil_color = vec3f(0.45, 0.32, 0.2);
  // Topsoil: rich dark brown, darker when wet
  let dry_topsoil = vec3f(0.4, 0.3, 0.15);
  let wet_topsoil = vec3f(0.2, 0.15, 0.08);
  let topsoil_color = mix(dry_topsoil, wet_topsoil, clamp(moisture * 2.5, 0.0, 1.0));

  // Layer boundaries
  var color: vec3f;
  if (depth_norm < 0.2) {
    color = bedrock_color;
  } else if (depth_norm < 0.5) {
    let t = (depth_norm - 0.2) / 0.3;
    color = mix(bedrock_color, subsoil_color, t);
  } else if (depth_norm < 0.7) {
    let t = (depth_norm - 0.5) / 0.2;
    color = mix(subsoil_color, topsoil_color, t);
  } else {
    color = topsoil_color;
  }

  // Add subtle horizontal stratification
  let strata = sin(depth_norm * 40.0) * 0.02;
  color += vec3f(strata);

  // Darker at edges for depth feel
  let edge_dark = 1.0 - abs(in.uv.x - 0.5) * 0.3;
  color *= edge_dark;

  return vec4f(color, 1.0);
}
