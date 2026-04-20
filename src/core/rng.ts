// xoshiro128** - fast, seedable 32-bit PRNG with good statistical properties
export class RNG {
  private s: Uint32Array;

  constructor(seed: number) {
    this.s = new Uint32Array(4);
    // SplitMix32 to initialize state from single seed
    let z = seed >>> 0;
    for (let i = 0; i < 4; i++) {
      z = (z + 0x9e3779b9) >>> 0;
      let t = z ^ (z >>> 16);
      t = Math.imul(t, 0x21f0aaad);
      t = t ^ (t >>> 15);
      t = Math.imul(t, 0x735a2d97);
      t = t ^ (t >>> 15);
      this.s[i] = t >>> 0;
    }
  }

  private rotl(x: number, k: number): number {
    return ((x << k) | (x >>> (32 - k))) >>> 0;
  }

  next(): number {
    const result = (Math.imul(this.rotl(Math.imul(this.s[1], 5), 7), 9)) >>> 0;
    const t = (this.s[1] << 9) >>> 0;

    this.s[2] = (this.s[2] ^ this.s[0]) >>> 0;
    this.s[3] = (this.s[3] ^ this.s[1]) >>> 0;
    this.s[1] = (this.s[1] ^ this.s[2]) >>> 0;
    this.s[0] = (this.s[0] ^ this.s[3]) >>> 0;
    this.s[2] = (this.s[2] ^ t) >>> 0;
    this.s[3] = this.rotl(this.s[3], 11);

    return result;
  }

  // Returns float in [0, 1)
  float(): number {
    return this.next() / 4294967296;
  }

  // Returns float in [min, max)
  range(min: number, max: number): number {
    return min + this.float() * (max - min);
  }

  // Gaussian via Box-Muller
  gaussian(mean = 0, stddev = 1): number {
    const u1 = this.float() || 1e-10;
    const u2 = this.float();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stddev;
  }
}
