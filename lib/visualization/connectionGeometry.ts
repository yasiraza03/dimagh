import { BufferAttribute, BufferGeometry, Color, DataTexture, FloatType, RGBAFormat } from 'three';
import { CONNECTION_INSTANCES, CONNECTION_SLOTS } from '@/lib/brain/atlas';
import { bezier } from '@/lib/simulation/engine';
import { PALETTE_HEX } from './palette';
import type { PaletteKey, Vec3 } from '@/lib/brain/types';

/**
 * Pathway geometry.
 *
 * Every connection in the atlas becomes a tube, and all of them are merged into
 * one BufferGeometry — a single draw call for the whole network. Per-vertex
 * attributes carry the connection's slot index, flow direction and conceptual
 * strength, and the live activation arrives via a small data texture so that
 * updating the whole network each frame costs one texture upload.
 *
 * Lines were the obvious alternative, but WebGL cannot draw thick lines
 * portably, and the network needs real thickness to read as pathways.
 */

const CATEGORY_COLOR: Record<string, PaletteKey> = {
  visual: 'cyan',
  orienting: 'cyan',
  motion: 'blue',
  auditory: 'amber',
  language: 'green',
  semantic: 'green',
  recognition: 'violet',
  memory: 'violet',
  consolidation: 'violet',
  attention: 'blue',
  reorienting: 'amber',
  control: 'orange',
  decision: 'orange',
  motor: 'orange',
  value: 'amber',
  salience: 'threat',
  affect: 'threat',
  autonomic: 'threat',
  regulation: 'violet',
  arousal: 'amber',
  feedback: 'violet',
  prediction: 'violet',
  correction: 'green',
  integration: 'cyan',
  state: 'blue',
};

function flowSign(direction: string): number {
  if (direction === 'forward') return 1;
  if (direction === 'backward') return -1;
  return 0;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Build the merged network geometry.
 *
 * @param lengthSegments points sampled along each pathway
 * @param radialSegments vertices around each tube
 */
export function buildConnectionGeometry(
  lengthSegments = 26,
  radialSegments = 5,
): BufferGeometry {
  const L = Math.max(6, lengthSegments);
  const R = Math.max(3, radialSegments);
  const instances = CONNECTION_INSTANCES;
  const vertsPerInstance = L * R;
  const totalVerts = instances.length * vertsPerInstance;
  const totalQuads = instances.length * (L - 1) * R;

  const position = new Float32Array(totalVerts * 3);
  const normal = new Float32Array(totalVerts * 3);
  const aT = new Float32Array(totalVerts);
  const aSlot = new Float32Array(totalVerts);
  const aFlow = new Float32Array(totalVerts);
  const aStrength = new Float32Array(totalVerts);
  const aColor = new Float32Array(totalVerts * 3);
  const index = new Uint32Array(totalQuads * 6);

  const tmp = new Color();
  let v = 0;
  let idx = 0;

  for (const inst of instances) {
    const { connection, curve, slot } = inst;
    const flow = flowSign(connection.direction);
    const strength = connection.strength;
    tmp.set(PALETTE_HEX[CATEGORY_COLOR[connection.category] ?? 'cyan']);

    // Thinner for weak conceptual pathways, so the network has visual hierarchy.
    // Kept genuinely fine: at close camera distances the previous radius read as
    // wide blades slashing across the cortex rather than as tracts.
    const radius = 0.0022 + strength * 0.0032;

    const base = v;
    // Parallel-transport the tube frame along the curve to avoid twisting.
    let prevNormal: Vec3 = [0, 1, 0];

    for (let i = 0; i < L; i++) {
      const t = i / (L - 1);
      const p = bezier(curve, t);
      const ahead = bezier(curve, Math.min(1, t + 0.004));
      const behind = bezier(curve, Math.max(0, t - 0.004));
      const tangent = normalize(sub(ahead, behind));

      // Project the previous normal onto the plane perpendicular to the tangent.
      let n: Vec3 = [
        prevNormal[0] - tangent[0] * dot(prevNormal, tangent),
        prevNormal[1] - tangent[1] * dot(prevNormal, tangent),
        prevNormal[2] - tangent[2] * dot(prevNormal, tangent),
      ];
      if (Math.hypot(n[0], n[1], n[2]) < 1e-4) {
        // Degenerate: pick any axis not parallel to the tangent.
        const alt: Vec3 = Math.abs(tangent[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
        n = cross(tangent, alt);
      }
      n = normalize(n);
      prevNormal = n;
      const b = normalize(cross(tangent, n));

      for (let j = 0; j < R; j++) {
        const a = (j / R) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const ox = n[0] * ca + b[0] * sa;
        const oy = n[1] * ca + b[1] * sa;
        const oz = n[2] * ca + b[2] * sa;

        position[v * 3] = p[0] + ox * radius;
        position[v * 3 + 1] = p[1] + oy * radius;
        position[v * 3 + 2] = p[2] + oz * radius;
        normal[v * 3] = ox;
        normal[v * 3 + 1] = oy;
        normal[v * 3 + 2] = oz;
        aT[v] = t;
        aSlot[v] = slot;
        aFlow[v] = flow;
        aStrength[v] = strength;
        aColor[v * 3] = tmp.r;
        aColor[v * 3 + 1] = tmp.g;
        aColor[v * 3 + 2] = tmp.b;
        v++;
      }
    }

    for (let i = 0; i < L - 1; i++) {
      for (let j = 0; j < R; j++) {
        const j2 = (j + 1) % R;
        const a = base + i * R + j;
        const bb = base + i * R + j2;
        const c = base + (i + 1) * R + j2;
        const d = base + (i + 1) * R + j;
        index[idx++] = a;
        index[idx++] = bb;
        index[idx++] = c;
        index[idx++] = a;
        index[idx++] = c;
        index[idx++] = d;
      }
    }
  }

  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(position, 3));
  g.setAttribute('normal', new BufferAttribute(normal, 3));
  g.setAttribute('aT', new BufferAttribute(aT, 1));
  g.setAttribute('aSlot', new BufferAttribute(aSlot, 1));
  g.setAttribute('aFlow', new BufferAttribute(aFlow, 1));
  g.setAttribute('aStrength', new BufferAttribute(aStrength, 1));
  g.setAttribute('aColor', new BufferAttribute(aColor, 3));
  g.setIndex(new BufferAttribute(index, 1));
  g.computeBoundingSphere();
  return g;
}

/**
 * The connection state texture: one pixel per connection slot.
 * r = activation, g = visibility mask, b = flow rate, a = unused.
 */
export function createConnectionTexture(): {
  texture: DataTexture;
  data: Float32Array;
} {
  const data = new Float32Array(CONNECTION_SLOTS * 4);
  for (let i = 0; i < CONNECTION_SLOTS; i++) {
    data[i * 4 + 1] = 1; // fully visible by default
    data[i * 4 + 2] = 1;
  }
  const texture = new DataTexture(data, CONNECTION_SLOTS, 1, RGBAFormat, FloatType);
  texture.needsUpdate = true;
  return { texture, data };
}

let cached: BufferGeometry | null = null;
let cachedKey = '';

/** Cached per (lengthSegments, radialSegments) so remounts are free. */
export function getConnectionGeometry(lengthSegments: number, radialSegments = 5) {
  const key = `${lengthSegments}:${radialSegments}`;
  if (cached && cachedKey === key) return cached;
  cached?.dispose();
  cached = buildConnectionGeometry(lengthSegments, radialSegments);
  cachedKey = key;
  return cached;
}
