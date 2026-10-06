/**
 * A compact 3D gradient-noise implementation.
 *
 * Used on the CPU at module load to displace the brain mesh into gyri and sulci.
 * Seeded and deterministic, so the geometry is byte-identical on every load and
 * between server and client.
 */

const PERM_SIZE = 256;

function buildPermutation(seed: number): Uint8Array {
  const p = new Uint8Array(PERM_SIZE * 2);
  const base = new Uint8Array(PERM_SIZE);
  for (let i = 0; i < PERM_SIZE; i++) base[i] = i;

  // xorshift32 — tiny, deterministic, good enough for shuffling.
  let s = seed || 1;
  const rand = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  for (let i = PERM_SIZE - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = base[i];
    base[i] = base[j];
    base[j] = t;
  }
  for (let i = 0; i < PERM_SIZE * 2; i++) p[i] = base[i & 255];
  return p;
}

const PERM = buildPermutation(0x9e3779b9);

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function grad(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

/** Classic gradient noise in roughly [-1, 1]. */
export function noise3(x: number, y: number, z: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const zf = z - Math.floor(z);
  const u = fade(xf);
  const v = fade(yf);
  const w = fade(zf);

  const A = PERM[X] + Y;
  const AA = PERM[A] + Z;
  const AB = PERM[A + 1] + Z;
  const B = PERM[X + 1] + Y;
  const BA = PERM[B] + Z;
  const BB = PERM[B + 1] + Z;

  const lerp = (t: number, a: number, b: number) => a + t * (b - a);

  return lerp(
    w,
    lerp(
      v,
      lerp(u, grad(PERM[AA], xf, yf, zf), grad(PERM[BA], xf - 1, yf, zf)),
      lerp(u, grad(PERM[AB], xf, yf - 1, zf), grad(PERM[BB], xf - 1, yf - 1, zf)),
    ),
    lerp(
      v,
      lerp(u, grad(PERM[AA + 1], xf, yf, zf - 1), grad(PERM[BA + 1], xf - 1, yf, zf - 1)),
      lerp(
        u,
        grad(PERM[AB + 1], xf, yf - 1, zf - 1),
        grad(PERM[BB + 1], xf - 1, yf - 1, zf - 1),
      ),
    ),
  );
}

/** Fractal sum of noise octaves. */
export function fbm(x: number, y: number, z: number, octaves = 3, lacunarity = 2.1, gain = 0.5): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * freq, y * freq, z * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/**
 * Ridged noise — absolute value inverted, which turns the smooth troughs of
 * gradient noise into sharp creases. This is what makes the cortical surface
 * read as folded rather than merely lumpy.
 */
export function ridged(x: number, y: number, z: number, octaves = 3): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise3(x * freq, y * freq, z * freq));
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return sum / norm;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0 || 1e-6)));
  return t * t * (3 - 2 * t);
}
