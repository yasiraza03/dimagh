'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';
import { renderState } from '@/lib/visualization/renderState';
import { rig } from '@/lib/visualization/cameraRig';

/**
 * Post-processing.
 *
 * Bloom is doing real work here, not decoration: the signal particles and
 * activity field are additive emissive layers, and bloom is what turns them
 * from bright pixels into light inside a volume.
 *
 * Chromatic aberration is driven by arousal and by how far inside the brain the
 * camera is, so the image itself tenses up during a threat response and
 * destabilises during a micro/macro dive. Both are kept small enough that you
 * feel them rather than see them.
 */
export function SceneEffects() {
  const offset = useRef(new Vector2(0, 0));
  const bloomRef = useRef<{ intensity: number } | null>(null);

  useFrame(() => {
    const a = renderState.arousal;
    const inside = rig.insideness;
    // Kept below the threshold of visible colour fringing: it should register
    // as tension, never as a rainbow edge on a monochrome scene.
    const amt = 0.00008 + a * 0.0005 + inside * 0.0004;
    offset.current.set(amt, amt * 0.72);
    if (bloomRef.current) {
      bloomRef.current.intensity = 0.3 + a * 0.22 + inside * 0.18;
    }
  });

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        ref={bloomRef as never}
        intensity={0.32}
        luminanceThreshold={0.52}
        luminanceSmoothing={0.22}
        mipmapBlur
        radius={0.6}
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={offset.current}
        radialModulation={false}
        modulationOffset={0}
      />
      <Vignette offset={0.3} darkness={0.62} eskil={false} />
    </EffectComposer>
  );
}
