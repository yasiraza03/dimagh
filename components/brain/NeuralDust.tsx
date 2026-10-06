'use client';

import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ShaderMaterial,
} from 'three';
import { sampleInsideBrain } from '@/lib/visualization/brainGeometry';
import { renderState } from '@/lib/visualization/renderState';
import { lensState } from '@/lib/visualization/lensState';
import { DUST_FRAG, DUST_VERT } from '@/lib/visualization/shaders';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import { useUIStore } from '@/store/uiStore';

/**
 * LAYER 7 — ambient neural dust.
 *
 * Thousands of points seeded *inside* the cerebral envelope (rather than in a
 * sphere, which looks like a particle demo) and animated entirely in the vertex
 * shader. The CPU writes the seeds once at mount and then only updates uTime,
 * so the particle count is effectively free.
 *
 * This is the layer that makes the brain feel inhabited rather than modelled.
 */

interface Props {
  budget: number;
  /** Scale the seeded volume; >1 pushes dust outside the shell. */
  spread?: number;
}

const COLOR_A = new Color(PALETTE_HEX.cyan);
const COLOR_B = new Color(PALETTE_HEX.violet);

export function NeuralDust({ budget, spread = 1.06 }: Props) {
  const dpr = useThree((s) => s.viewport.dpr);
  const reducedMotion = useUIStore((s) => s.reducedMotion);

  const { geometry, material } = useMemo(() => {
    const seeds = sampleInsideBrain(budget);
    const phase = new Float32Array(budget);
    const size = new Float32Array(budget);
    for (let i = 0; i < budget; i++) {
      // Deterministic, so the field is identical on every load.
      const h = Math.sin(i * 78.233) * 43758.5453;
      phase[i] = h - Math.floor(h);
      const h2 = Math.sin(i * 12.9898) * 43758.5453;
      size[i] = 0.6 + (h2 - Math.floor(h2)) * 2.2;
    }

    const geometry = new BufferGeometry();
    // `position` is required by three even though the shader uses aSeed.
    geometry.setAttribute('position', new BufferAttribute(seeds, 3));
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 3));
    geometry.setAttribute('aPhase', new BufferAttribute(phase, 1));
    geometry.setAttribute('aSize', new BufferAttribute(size, 1));
    geometry.computeBoundingSphere();

    const material = new ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 1.4 },
        uSpread: { value: spread },
        uDrift: { value: 1 },
        uPixelRatio: { value: 1 },
        uColorA: { value: COLOR_A.clone() },
        uColorB: { value: COLOR_B.clone() },
        uOpacity: { value: 0.3 },
      },
    });

    return { geometry, material };
  }, [budget, spread]);

  useFrame(() => {
    const u = material.uniforms;
    u.uTime.value = renderState.elapsed;
    u.uPixelRatio.value = dpr;
    u.uOpacity.value = lensState.cur.dustOpacity;
    u.uDrift.value = reducedMotion ? 0.15 : 1;
    // Arousal warms the field and tightens its motion.
    const a = renderState.arousal;
    u.uColorB.value.setRGB(
      COLOR_B.r + a * 0.6,
      COLOR_B.g - a * 0.2,
      COLOR_B.b - a * 0.55,
    );
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
