'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BackSide,
  Color,
  FrontSide,
  ShaderMaterial,
  type Mesh,
} from 'three';
import { getBrainGeometry, getBrainShell } from '@/lib/visualization/brainGeometry';
import { renderState, REGION_COUNT } from '@/lib/visualization/renderState';
import { lensState, effectiveShellOpacity } from '@/lib/visualization/lensState';
import {
  CORE_FRAG,
  CORE_VERT,
  SHELL_FRAG,
  SHELL_VERT,
} from '@/lib/visualization/shaders';
import { useUIStore } from '@/store/uiStore';

/**
 * LAYER 1 & 5 — cortical anatomy and the activity field.
 *
 * Three meshes share one shell material (cerebrum, cerebellum, brainstem) and a
 * fourth renders the inner volume. All four read their activity from the shared
 * uniform arrays in renderState, so a scenario drives the surface and the
 * interior with a single evaluation per frame.
 */

interface Props {
  /** Icosphere subdivision level. See detailForSegments(). */
  detail: number;
}

/**
 * Cortical palette. A warm pink-grey crown against a cool, much darker sulcus
 * reads as tissue; a single flat grey reads as a clay model. The sulcus colour
 * is deliberately far darker than it "should" be — the brain sits on near-black
 * and needs that much internal contrast to show its folding.
 */
/**
 * Monochrome cortex. A light neutral crown against a very dark sulcus: on a
 * near-black page the folding only reads if the internal contrast is this wide.
 * The rim is a cool off-white rather than cyan so the silhouette does not tint
 * the whole scene.
 */
const SURFACE = new Color('#c3c6ca');
const SULCUS = new Color('#101216');
const RIM = new Color('#aeb6bf');
const SSS = new Color('#8e8b88');

export function BrainModel({ detail }: Props) {
  const highContrast = useUIStore((s) => s.highContrast);
  const reducedMotion = useUIStore((s) => s.reducedMotion);

  const geo = useMemo(() => getBrainGeometry(detail), [detail]);
  const coreGeo = useMemo(() => getBrainShell(0.9), []);

  const shellMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: SHELL_VERT,
        fragmentShader: SHELL_FRAG,
        defines: { REGION_COUNT },
        transparent: true,
        depthWrite: true,
        side: FrontSide,
        uniforms: {
          uTime: { value: 0 },
          uBreath: { value: 1 },
          uFieldReach: { value: 2.9 },
          uRegion: { value: renderState.regionGeom },
          uRegionCol: { value: renderState.regionCol },
          uRegionAct: { value: renderState.regionAct },
          uRegionMask: { value: renderState.regionMask },
          uSurface: { value: SURFACE.clone() },
          uSulcus: { value: SULCUS.clone() },
          uRim: { value: RIM.clone() },
          uSSS: { value: SSS.clone() },
          uSheen: { value: 1 },
          uBump: { value: 0.85 },
          uOpacity: { value: 1 },
          uActivityGain: { value: 0.1 },
          uAnatomyTint: { value: 1 },
          uGrain: { value: 0.035 },
          uWireframeMix: { value: 1 },
          uHighContrast: { value: 0 },
        },
      }),
    [],
  );

  const coreMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: CORE_VERT,
        fragmentShader: CORE_FRAG,
        defines: { REGION_COUNT },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: AdditiveBlending,
        // Back faces only: the glow then reads as light inside the volume
        // rather than as a solid object sitting in front of the cortex.
        side: BackSide,
        uniforms: {
          uTime: { value: 0 },
          uFieldReach: { value: 3.4 },
          uGain: { value: 0.2 },
          uRegion: { value: renderState.regionGeom },
          uRegionCol: { value: renderState.regionCol },
          uRegionAct: { value: renderState.regionAct },
          uRegionMask: { value: renderState.regionMask },
        },
      }),
    [],
  );

  const cerebrumRef = useRef<Mesh>(null);

  useFrame(() => {
    const t = renderState.elapsed;
    const su = shellMat.uniforms;
    su.uTime.value = t;
    su.uOpacity.value = effectiveShellOpacity();
    su.uActivityGain.value = lensState.cur.activityGain;
    su.uAnatomyTint.value = lensState.cur.anatomyTint;
    su.uWireframeMix.value = lensState.cur.contours;
    su.uHighContrast.value = highContrast ? 1 : 0;
    su.uGrain.value = highContrast ? 0 : 0.03;
    su.uSheen.value = highContrast ? 0.3 : 1;
    // High contrast wants flat, legible shading rather than micro-relief.
    su.uBump.value = highContrast ? 0.3 : 0.85;
    su.uBreath.value = reducedMotion ? 0 : 1;

    // Arousal warms the rim and pushes the surface slightly hotter. This is how
    // the Emotion lens changes the atmosphere rather than only the colours.
    // Arousal only shifts the rim very slightly warm — a tell, not a colour cast.
    const a = renderState.arousal;
    su.uRim.value.setRGB(
      RIM.r + a * 0.14,
      RIM.g - a * 0.03,
      RIM.b - a * 0.1,
    );

    const cu = coreMat.uniforms;
    cu.uTime.value = t;
    cu.uGain.value = lensState.cur.coreGain;
  });

  return (
    <group>
      <mesh ref={cerebrumRef} geometry={geo.cerebrum} material={shellMat} />
      <mesh geometry={geo.cerebellum} material={shellMat} />
      <mesh geometry={geo.brainstem} material={shellMat} />
      <mesh geometry={coreGeo} material={coreMat} renderOrder={-1} />
    </group>
  );
}
