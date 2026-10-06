'use client';

import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  ShaderMaterial,
} from 'three';
import { renderState } from '@/lib/visualization/renderState';
import { bezier } from '@/lib/simulation/engine';
import { SIGNAL_FRAG, SIGNAL_VERT } from '@/lib/visualization/shaders';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import type { Vec3 } from '@/lib/brain/types';

/**
 * LAYER 4 — signal particles.
 *
 * A fixed pool of billboarded instances, re-assigned every frame to whichever
 * signals are currently in flight. Positions are computed on the CPU, which is
 * a deliberate choice: the alternative (baking birth times into instanced
 * attributes and animating on the GPU) breaks the moment you scrub, reverse or
 * jump the timeline. At ~900 particles the CPU cost is a rounding error, and
 * every frame is an exact function of scenario time — so reversing just works.
 *
 * The ambient field, which never needs to be scrub-accurate, *is* fully on the
 * GPU. See NeuralDust.
 */

interface Props {
  /** Pool size, from the quality budget. */
  budget: number;
}

/** Particles per signal strand. Trails read as motion blur along the path. */
const PER_STRAND = 22;
/** Spacing between trail particles, as a fraction of the path. */
const TRAIL_SPACING = 0.016;

const colorCache = new Map<string, Color>();
function cachedColor(key: string): Color {
  let c = colorCache.get(key);
  if (!c) {
    c = new Color(PALETTE_HEX[key as keyof typeof PALETTE_HEX] ?? PALETTE_HEX.cyan);
    colorCache.set(key, c);
  }
  return c;
}

/** Deterministic jitter so the strand has thickness without looking random. */
function jitter(i: number, axis: number): number {
  const s = Math.sin(i * 12.9898 + axis * 78.233) * 43758.5453;
  return (s - Math.floor(s)) - 0.5;
}

export function SignalParticles({ budget }: Props) {
  const { geometry, material, offsets, params, colors } = useMemo(() => {
    const count = budget;

    const geometry = new InstancedBufferGeometry();
    // A unit quad, expanded to a billboard in the vertex shader.
    geometry.setAttribute(
      'position',
      new BufferAttribute(
        new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]),
        3,
      ),
    );
    geometry.setAttribute(
      'uv',
      new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2),
    );
    geometry.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1));

    const offsets = new Float32Array(count * 3);
    const params = new Float32Array(count * 4);
    const colors = new Float32Array(count * 3);

    const offAttr = new InstancedBufferAttribute(offsets, 3);
    const parAttr = new InstancedBufferAttribute(params, 4);
    const colAttr = new InstancedBufferAttribute(colors, 3);
    offAttr.setUsage(35048);
    parAttr.setUsage(35048);
    colAttr.setUsage(35048);

    geometry.setAttribute('aOffset', offAttr);
    geometry.setAttribute('aParams', parAttr);
    geometry.setAttribute('aColor', colAttr);
    geometry.instanceCount = count;
    // Signals travel outside the cerebral envelope on peripheral pathways, so
    // automatic culling would pop them out of existence.
    geometry.boundingSphere = null;

    const material = new ShaderMaterial({
      vertexShader: SIGNAL_VERT,
      fragmentShader: SIGNAL_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 1 },
      },
    });

    return { geometry, material, offsets, params, colors };
  }, [budget]);

  useFrame(() => {
    const signals = renderState.frame.signals;
    const count = budget;
    let w = 0;

    renderState.hasFollowHead = false;

    for (const sig of signals) {
      const c = cachedColor(sig.color);
      for (const curve of sig.curves) {
        if (w + PER_STRAND > count) break;
        for (let p = 0; p < PER_STRAND; p++) {
          const t = sig.progress - p * TRAIL_SPACING;
          const i = w + p;
          if (t < 0 || t > 1) {
            params[i * 4] = 0;
            params[i * 4 + 1] = 0;
            continue;
          }
          const pos = bezier(curve as [Vec3, Vec3, Vec3, Vec3], t);
          // Trail thins and dims behind the head.
          const fall = 1 - p / PER_STRAND;
          const spread = 0.008 * (1 - fall) + 0.002;
          offsets[i * 3] = pos[0] + jitter(i, 0) * spread;
          offsets[i * 3 + 1] = pos[1] + jitter(i, 1) * spread;
          offsets[i * 3 + 2] = pos[2] + jitter(i, 2) * spread;

          params[i * 4] = (0.014 + 0.03 * fall * fall) * (0.6 + sig.intensity * 0.7);
          params[i * 4 + 1] = fall * fall * sig.intensity * 1.5;
          params[i * 4 + 2] = fall;
          params[i * 4 + 3] = p;

          colors[i * 3] = c.r;
          colors[i * 3 + 1] = c.g;
          colors[i * 3 + 2] = c.b;
        }
        w += PER_STRAND;
      }
      // The first strand's head is what the follow camera tracks.
      if (!renderState.hasFollowHead) {
        renderState.followHead.set(sig.head[0], sig.head[1], sig.head[2]);
        renderState.hasFollowHead = true;
      }
    }

    // Retire the rest of the pool.
    for (let i = w; i < count; i++) {
      if (params[i * 4] === 0 && params[i * 4 + 1] === 0) continue;
      params[i * 4] = 0;
      params[i * 4 + 1] = 0;
    }

    (geometry.getAttribute('aOffset') as InstancedBufferAttribute).needsUpdate = true;
    (geometry.getAttribute('aParams') as InstancedBufferAttribute).needsUpdate = true;
    (geometry.getAttribute('aColor') as InstancedBufferAttribute).needsUpdate = true;
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
