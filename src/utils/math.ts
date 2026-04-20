export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function remap(value: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number {
  const t = (value - fromMin) / (fromMax - fromMin);
  return lerp(toMin, toMax, clamp(t, 0, 1));
}
