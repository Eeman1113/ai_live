// Fullscreen triangle (covers screen with single triangle, no vertex buffer needed)
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs_main(@builtin(vertex_index) idx: u32) -> VertexOutput {
  var out: VertexOutput;
  // Generate fullscreen triangle
  let x = f32(i32(idx) / 2) * 4.0 - 1.0;
  let y = f32(i32(idx) % 2) * 4.0 - 1.0;
  out.position = vec4f(x, y, 0.0, 1.0);
  out.uv = vec2f((x + 1.0) * 0.5, (1.0 - y) * 0.5);
  return out;
}
