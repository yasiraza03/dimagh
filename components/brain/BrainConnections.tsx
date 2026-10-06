'use client';

import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, FrontSide, ShaderMaterial } from 'three';
import { getConnectionGeometry } from '@/lib/visualization/connectionGeometry';
import { CONNECTION_SLOTS } from '@/lib/brain/atlas';
import { renderState } from '@/lib/visualization/renderState';
import { lensState } from '@/lib/visualization/lensState';
import {
  CONNECTION_FRAG,
  CONNECTION_VERT,
} from '@/lib/visualization/shaders';

/**
 * LAYER 3 — the connection graph.
 *
 * All ~150 pathway tubes are one merged geometry and one draw call. Live state
 * (activation, visibility, flow rate) arrives through a 128×1 data texture, so
 * updating the entire network each frame is a single small upload.
 *
 * Direction is communicated by which way the travelling band moves:
 * feed-forward runs source→target, feedback runs the other way, and
 * bidirectional pathways carry two counter-travelling bands.
 */

interface Props {
  /** Length segments per pathway; from the quality budget. */
  segments: number;
}

export function BrainConnections({ segments }: Props) {
  const geometry = useMemo(() => getConnectionGeometry(segments), [segments]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: CONNECTION_VERT,
        fragmentShader: CONNECTION_FRAG,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        // Front faces only. With both walls of a tube drawn additively every
        // pathway rendered at double brightness and read as a flat ribbon.
        side: FrontSide,
        uniforms: {
          uTime: { value: 0 },
          uConnTex: { value: renderState.connTexture },
          uConnTexWidth: { value: CONNECTION_SLOTS },
          uThickness: { value: 1 },
          uBaseAlpha: { value: 0 },
          uPulse: { value: 1 },
        },
      }),
    [],
  );

  useFrame(() => {
    const u = material.uniforms;
    u.uTime.value = renderState.elapsed;
    u.uBaseAlpha.value = lensState.cur.connectionBase;
    u.uPulse.value = lensState.cur.connectionPulse;
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
