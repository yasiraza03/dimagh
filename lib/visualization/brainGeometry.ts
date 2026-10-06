import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  IcosahedronGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { ridged, smoothstep } from './noise';

/**
 * Procedural brain geometry.
 *
 * We build the brain rather than loading an asset, for three reasons: there is
 * no licensing question, the mesh carries the extra per-vertex data the shaders
 * need (fold depth, hemisphere, lobe id), and the resolution can be chosen at
 * runtime for the device.
 *
 * It is anatomically *inspired*, not anatomically accurate — a stylised
 * representation whose proportions and folding read as a brain. The science
 * panels say so explicitly.
 */

export interface BrainGeometrySet {
  cerebrum: BufferGeometry;
  cerebellum: BufferGeometry;
  brainstem: BufferGeometry;
}

/** Overall proportions of the cerebrum in world units. */
const CEREBRUM = { x: 0.74, y: 0.605, z: 0.98 };

/** Fold frequency and depth. Higher frequency with lower amplitude reads finer. */
const FOLD_FREQ = 8.6;
const FOLD_AMP = 0.044;

/**
 * A soft groove carved into the envelope.
 *
 * Returns 0–1 falloff for a point's distance from a plane-ish locus. Real sulci
 * are what make a brain recognisable — the noise-driven gyri alone read as a
 * lumpy ball — so the three major ones are modelled explicitly rather than left
 * to chance.
 */
function groove(distance: number, width: number): number {
  const t = Math.min(1, Math.abs(distance) / width);
  const f = 1 - t;
  return f * f * (3 - 2 * t);
}

/**
 * Deform a point on the unit sphere into the cerebral envelope.
 *
 * Each step is a named anatomical feature rather than a magic number: poles
 * taper, the temporal lobe bulges laterally and downward, the base flattens,
 * and the longitudinal, lateral (Sylvian) and central sulci are cut explicitly.
 */
function cerebrumEnvelope(dx: number, dy: number, dz: number): [number, number, number] {
  let x = dx * CEREBRUM.x;
  let y = dy * CEREBRUM.y;
  let z = dz * CEREBRUM.z;

  // Frontal pole: narrower and slightly lower than the mid-brain.
  const frontal = smoothstep(0.3, 1, dz);
  x *= 1 - 0.2 * frontal;
  y *= 1 - 0.13 * frontal;

  // Occipital pole: narrower still, and pulled down.
  const occipital = smoothstep(0.4, 1, -dz);
  x *= 1 - 0.24 * occipital;
  y *= 1 - 0.17 * occipital;
  y -= 0.05 * occipital;

  // Temporal lobe: a lateral, inferior bulge over the middle third.
  const lateral = Math.abs(dx);
  const temporal =
    smoothstep(0.38, 0.92, lateral) *
    smoothstep(0.32, -0.58, dy) *
    (1 - smoothstep(0.5, 0.98, Math.abs(dz)));
  x += Math.sign(dx) * 0.115 * temporal;
  y -= 0.135 * temporal;

  // Base flattening: the inferior surface sits on the skull floor.
  const inferior = smoothstep(-0.3, -1, dy);
  y += 0.16 * inferior;

  // Superior surface is broad and only gently domed.
  const superior = smoothstep(0.5, 1, dy);
  y *= 1 - 0.05 * superior;

  const r = Math.hypot(x, y, z) || 1;
  const nx = x / r;
  const ny = y / r;
  const nz = z / r;
  let carve = 0;

  // 1. Longitudinal fissure — the deep midline cleft separating the hemispheres.
  //    Deepest on the superior surface, shallow underneath where the corpus
  //    callosum joins them.
  const longitudinal =
    groove(dx, 0.1) * smoothstep(-0.42, 0.25, dy);
  carve += longitudinal * 0.1;

  // 2. Lateral (Sylvian) fissure — the big diagonal groove above the temporal
  //    lobe. The single most recognisable landmark on a lateral view.
  const sylvianLine = dy + 0.1 + dz * 0.3;
  const sylvian =
    groove(sylvianLine, 0.11) *
    smoothstep(0.3, 0.72, lateral) *
    (1 - smoothstep(0.55, 0.95, Math.abs(dz)));
  carve += sylvian * 0.055;

  // 3. Central sulcus — runs down and forward from near the vertex.
  const centralLine = dz - 0.14 + Math.abs(dx) * 0.42;
  const central =
    groove(centralLine, 0.075) * smoothstep(-0.1, 0.45, dy);
  carve += central * 0.032;

  x -= nx * carve;
  y -= ny * carve;
  z -= nz * carve;

  // The midline fissure also pinches the hemispheres slightly together.
  z *= 1 - 0.015 * longitudinal;

  return [x, y, z];
}

/**
 * Fold depth at a surface point, in [0,1]. Sampled anisotropically (stretched
 * in y) so the folds run roughly horizontally, the way gyri actually do.
 */
function foldDepth(x: number, y: number, z: number): number {
  // Three scales: broad gyral bands, the gyri themselves, and surface detail.
  // The anisotropic y-stretch is what makes folds run roughly horizontally the
  // way real gyri do, instead of looking like generic noise bumps.
  const broad = ridged(x * FOLD_FREQ * 0.42, y * FOLD_FREQ * 0.8, z * FOLD_FREQ * 0.4, 2);
  const primary = ridged(x * FOLD_FREQ, y * FOLD_FREQ * 2.1, z * FOLD_FREQ * 0.9, 3);
  const detail = ridged(
    x * FOLD_FREQ * 2.8 + 11.3,
    y * FOLD_FREQ * 4.4,
    z * FOLD_FREQ * 2.5,
    2,
  );
  return broad * 0.26 + primary * 0.56 + detail * 0.18;
}

/**
 * A high-frequency fold field used only for shading, never for displacement.
 *
 * Geometry can only carry folds down to its edge length; past that, more
 * triangles is the expensive answer. Instead we sample a finer field here,
 * take its gradient on the CPU, and hand that to the shader as a per-vertex
 * attribute. The fragment shader tilts the normal by it, so the surface reads
 * as having far more sulcal detail than the mesh actually contains — a normal
 * map, generated from the same noise that made the shape, with no texture
 * lookup and no derivative instructions.
 */
function microDepth(x: number, y: number, z: number): number {
  return ridged(
    x * FOLD_FREQ * 2.9 + 31.7,
    y * FOLD_FREQ * 5.6,
    z * FOLD_FREQ * 2.7,
    2,
  );
}

/**
 * Tangential gradient of the micro field at a point on the unit sphere.
 *
 * Only the fine band is sampled, not the macro folds: the macro folds are
 * already in the geometry and in the per-vertex fold value, so including them
 * here would double-count them and triple the generation cost. Twelve noise
 * evaluations per vertex, once, at module load.
 */
function shadingGradient(dx: number, dy: number, dz: number): [number, number, number] {
  const e = 0.0035;
  let gx = (microDepth(dx + e, dy, dz) - microDepth(dx - e, dy, dz)) / (2 * e);
  let gy = (microDepth(dx, dy + e, dz) - microDepth(dx, dy - e, dz)) / (2 * e);
  let gz = (microDepth(dx, dy, dz + e) - microDepth(dx, dy, dz - e)) / (2 * e);

  // Project out the radial component: only the slope *along the surface* tilts
  // the normal. A radial component would just brighten or darken uniformly.
  const radial = gx * dx + gy * dy + gz * dz;
  gx -= dx * radial;
  gy -= dy * radial;
  gz -= dz * radial;

  // Scaled into a range the shader can use directly, and clamped so a near
  // vertical crease cannot flip the normal inside out.
  const SCALE = 0.016;
  const m = Math.hypot(gx, gy, gz) * SCALE;
  const k = m > 1 ? SCALE / m : SCALE;
  return [gx * k, gy * k, gz * k];
}

/** Coarse lobe id per vertex, used by the shader to tint anatomical divisions. */
function lobeId(dx: number, dy: number, dz: number): number {
  if (dz > 0.34) return 0; // frontal
  if (dz < -0.42) return 1; // occipital
  if (Math.abs(dx) > 0.52 && dy < 0.05) return 2; // temporal
  if (dy > 0.3) return 3; // parietal
  return 4; // insular / central
}

function buildCerebrum(detail: number): BufferGeometry {
  const src = new IcosahedronGeometry(1, detail);
  const pos = src.attributes.position as BufferAttribute;
  const count = pos.count;

  const out = new Float32Array(count * 3);
  const fold = new Float32Array(count);
  const hemi = new Float32Array(count);
  const lobe = new Float32Array(count);
  const dir = new Float32Array(count * 3);
  const grad = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const dx = pos.getX(i);
    const dy = pos.getY(i);
    const dz = pos.getZ(i);

    const [ex, ey, ez] = cerebrumEnvelope(dx, dy, dz);
    const [gx, gy, gz] = shadingGradient(dx, dy, dz);
    grad[i * 3] = gx;
    grad[i * 3 + 1] = gy;
    grad[i * 3 + 2] = gz;

    // Fold displacement runs along the local radial direction.
    const raw = foldDepth(dx, dy, dz);
    // Sharpen: push values away from the midpoint so crowns and sulci separate
    // instead of blending into a soft bumpy surface.
    const d = Math.max(0, Math.min(1, 0.5 + (raw - 0.5) * 1.45));
    // Suppress folding at the base and on the brainstem shelf, where the real
    // surface is smooth, and inside the midline fissure.
    const smoothMask =
      (1 - smoothstep(-0.45, -0.95, dy)) *
      (1 - 0.7 * Math.exp(-(dx * dx) / (2 * 0.06 * 0.06)));
    const push = (d - 0.5) * FOLD_AMP * smoothMask;

    const len = Math.hypot(ex, ey, ez) || 1;
    out[i * 3] = ex + (ex / len) * push;
    out[i * 3 + 1] = ey + (ey / len) * push;
    out[i * 3 + 2] = ez + (ez / len) * push;

    fold[i] = d;
    hemi[i] = dx >= 0 ? 1 : -1;
    lobe[i] = lobeId(dx, dy, dz);
    dir[i * 3] = dx;
    dir[i * 3 + 1] = dy;
    dir[i * 3 + 2] = dz;
  }

  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(out, 3));
  g.setAttribute('aFold', new BufferAttribute(fold, 1));
  g.setAttribute('aHemi', new BufferAttribute(hemi, 1));
  g.setAttribute('aLobe', new BufferAttribute(lobe, 1));
  g.setAttribute('aDir', new BufferAttribute(dir, 3));
  g.setAttribute('aFoldGrad', new BufferAttribute(grad, 3));
  if (src.index) g.setIndex(src.index.clone());
  g.computeVertexNormals();
  g.computeBoundingSphere();
  src.dispose();
  return g;
}

/**
 * The cerebellum. Flattened, tucked under the occipital pole, and folded with
 * fine parallel folia rather than the cerebrum's irregular gyri — the
 * difference is one of the most recognisable things about it.
 */
function buildCerebellum(detail: number): BufferGeometry {
  const src = new IcosahedronGeometry(1, Math.max(2, detail - 1));
  const pos = src.attributes.position as BufferAttribute;
  const count = pos.count;

  const out = new Float32Array(count * 3);
  const fold = new Float32Array(count);
  const hemi = new Float32Array(count);
  const lobe = new Float32Array(count);
  const dir = new Float32Array(count * 3);
  const grad = new Float32Array(count * 3);

  const CX = 0.33;
  const CY = 0.165;
  const CZ = 0.25;
  const CENTER = [0, -0.44, -0.72];

  for (let i = 0; i < count; i++) {
    const dx = pos.getX(i);
    const dy = pos.getY(i);
    const dz = pos.getZ(i);

    let x = dx * CX;
    let y = dy * CY;
    let z = dz * CZ;

    // Vermis: a narrow midline ridge separating the two halves.
    const vermis = Math.exp(-(dx * dx) / (2 * 0.1 * 0.1));
    y -= 0.03 * vermis * smoothstep(-0.2, 0.6, dy);

    // Taper the anterior face where it meets the brainstem.
    const anterior = smoothstep(0.2, 1, dz);
    x *= 1 - 0.18 * anterior;
    y *= 1 - 0.1 * anterior;

    // Folia: dense, near-parallel transverse ridges.
    const folia = Math.sin(dy * 46 + dz * 7) * 0.5 + 0.5;
    const fine = ridged(dx * 22, dy * 30, dz * 22, 2);
    const d = folia * 0.72 + fine * 0.28;
    const push = (d - 0.5) * 0.013;

    // Folia are near-parallel transverse ridges, so their shading gradient is
    // dominated by the analytic derivative of that sine — no sampling needed.
    const dFolia = Math.cos(dy * 46 + dz * 7) * 0.5;
    let ggx = 0;
    let ggy = dFolia * 46;
    let ggz = dFolia * 7;
    const rad = ggx * dx + ggy * dy + ggz * dz;
    ggx -= dx * rad;
    ggy -= dy * rad;
    ggz -= dz * rad;
    const gs = 0.0045;
    grad[i * 3] = ggx * gs;
    grad[i * 3 + 1] = ggy * gs;
    grad[i * 3 + 2] = ggz * gs;

    const len = Math.hypot(x, y, z) || 1;
    out[i * 3] = CENTER[0] + x + (x / len) * push;
    out[i * 3 + 1] = CENTER[1] + y + (y / len) * push;
    out[i * 3 + 2] = CENTER[2] + z + (z / len) * push;

    fold[i] = d;
    hemi[i] = dx >= 0 ? 1 : -1;
    lobe[i] = 5; // cerebellum
    dir[i * 3] = dx;
    dir[i * 3 + 1] = dy;
    dir[i * 3 + 2] = dz;
  }

  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(out, 3));
  g.setAttribute('aFold', new BufferAttribute(fold, 1));
  g.setAttribute('aHemi', new BufferAttribute(hemi, 1));
  g.setAttribute('aLobe', new BufferAttribute(lobe, 1));
  g.setAttribute('aDir', new BufferAttribute(dir, 3));
  g.setAttribute('aFoldGrad', new BufferAttribute(grad, 3));
  if (src.index) g.setIndex(src.index.clone());
  g.computeVertexNormals();
  g.computeBoundingSphere();
  src.dispose();
  return g;
}

/** The brainstem: a smooth tapered tube descending from the thalamic region. */
function buildBrainstem(detail: number): BufferGeometry {
  const curve = new CatmullRomCurve3([
    new Vector3(0, 0.05, 0.08),
    new Vector3(0, -0.14, 0.04),
    new Vector3(0, -0.34, -0.04),
    new Vector3(0, -0.56, -0.1),
    new Vector3(0, -0.78, -0.14),
  ]);
  const segments = detail >= 5 ? 48 : 26;
  const radial = detail >= 5 ? 20 : 12;
  const src = new TubeGeometry(curve, segments, 0.1, radial, false);

  const pos = src.attributes.position as BufferAttribute;
  const count = pos.count;
  const out = new Float32Array(count * 3);
  const fold = new Float32Array(count);
  const hemi = new Float32Array(count);
  const lobe = new Float32Array(count);
  const dir = new Float32Array(count * 3);
  // The brainstem is smooth; it carries a zero gradient so it stays so.
  const grad = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Taper downward: the medulla is narrower than the midbrain.
    const t = smoothstep(0.05, -0.78, y);
    const scale = 1 - 0.42 * t;
    out[i * 3] = x * scale;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z * scale * 1.05;
    fold[i] = 0.62;
    hemi[i] = x >= 0 ? 1 : -1;
    lobe[i] = 6; // brainstem
    const l = Math.hypot(x, y, z) || 1;
    dir[i * 3] = x / l;
    dir[i * 3 + 1] = y / l;
    dir[i * 3 + 2] = z / l;
  }

  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(out, 3));
  g.setAttribute('aFold', new BufferAttribute(fold, 1));
  g.setAttribute('aHemi', new BufferAttribute(hemi, 1));
  g.setAttribute('aLobe', new BufferAttribute(lobe, 1));
  g.setAttribute('aDir', new BufferAttribute(dir, 3));
  g.setAttribute('aFoldGrad', new BufferAttribute(grad, 3));
  if (src.index) g.setIndex(src.index.clone());
  g.computeVertexNormals();
  g.computeBoundingSphere();
  src.dispose();
  return g;
}

/**
 * Icosphere subdivision level per quality tier. Vertex counts: 3 → 642,
 * 4 → 2562, 5 → 10242, 6 → 40962.
 */
export function detailForSegments(segments: number): number {
  // Level 5 (10k verts) still shows facets on a silhouette this large, so the
  // two upper tiers both run at 6 (41k verts) — the cost is in generation, which
  // happens once and is cached, not per frame.
  if (segments >= 100) return 6;
  if (segments >= 64) return 6;
  return 5;
}

const cache = new Map<number, BrainGeometrySet>();

/**
 * Build (or return the cached) brain geometry for a detail level. Generation
 * costs tens of milliseconds at the top level, so it is cached and shared
 * across every mount for the lifetime of the page.
 */
export function getBrainGeometry(detail: number): BrainGeometrySet {
  const hit = cache.get(detail);
  if (hit) return hit;
  const set: BrainGeometrySet = {
    cerebrum: buildCerebrum(detail),
    cerebellum: buildCerebellum(detail),
    brainstem: buildBrainstem(detail),
  };
  cache.set(detail, set);
  return set;
}

/**
 * A low-resolution convex-ish hull of the cerebrum, used for the inner activity
 * volume and for the landing-screen silhouette where folding is invisible.
 */
export function getBrainShell(scale = 0.94): BufferGeometry {
  const src = new IcosahedronGeometry(1, 3);
  const pos = src.attributes.position as BufferAttribute;
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = cerebrumEnvelope(pos.getX(i), pos.getY(i), pos.getZ(i));
    out[i * 3] = x * scale;
    out[i * 3 + 1] = y * scale;
    out[i * 3 + 2] = z * scale;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(out, 3));
  if (src.index) g.setIndex(src.index.clone());
  g.computeVertexNormals();
  g.computeBoundingSphere();
  src.dispose();
  return g;
}

/**
 * Sample points inside the cerebral envelope. Used to seed the ambient
 * particle field so the dust sits inside the brain rather than in a sphere.
 */
export function sampleInsideBrain(count: number, seed = 1337): Float32Array {
  const out = new Float32Array(count * 3);
  let s = seed;
  const rand = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  let i = 0;
  let guard = 0;
  while (i < count && guard < count * 60) {
    guard++;
    const x = (rand() * 2 - 1) * 0.86;
    const y = (rand() * 2 - 1) * 0.72;
    const z = (rand() * 2 - 1) * 1.08;
    // Reject outside a slightly shrunken envelope.
    const q = (x / 0.7) ** 2 + (y / 0.56) ** 2 + (z / 0.93) ** 2;
    if (q > 1) continue;
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
    i++;
  }
  return out;
}
