export type RGB = [number, number, number];

export function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

// Palette for species differentiation
export const SPECIES_PALETTE: RGB[] = [
  [0.2, 0.65, 0.2],   // green
  [0.4, 0.7, 0.15],   // yellow-green
  [0.15, 0.5, 0.35],  // teal-green
  [0.5, 0.6, 0.1],    // olive
  [0.25, 0.7, 0.4],   // spring green
  [0.35, 0.55, 0.2],  // forest
  [0.3, 0.6, 0.3],    // medium green
  [0.45, 0.65, 0.2],  // lime
];

export function hslToRgb(h: number, s: number, l: number): RGB {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [r, g, b];
}
