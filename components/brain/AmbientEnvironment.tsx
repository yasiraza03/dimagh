'use client';

import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Color, ShaderMaterial, SphereGeometry } from 'three';
import { renderState } from '@/lib/visualization/renderState';
import { useUIStore } from '@/store/uiStore';

/**
 * LAYER 7 — ambient environment.
 *
 * A large inverted sphere carrying a very dark gradient, plus a faint pool of
 * light below the brain. Pure black behind a 3D object removes every depth cue
 * the silhouette could use; this gives the scene an inside, a floor and a
 * horizon without ever becoming visible as a background.
 *
 * It also responds to arousal — the environment warms during a threat response,
 * which is how the atmosphere changes rather than only the brain.
 */

// Neutral greys only. The previous blue-violet gradient tinted the whole scene
// and fought the monochrome palette; the backdrop's job is to give the
// silhouette something to sit against, not to add colour.
const TOP = new Color('#07080b');
const HORIZON = new Color('#0e1014');
const BOTTOM = new Color('#030405');
const GROUND = new Color('#1a1d22');

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3  uTop;
  uniform vec3  uHorizon;
  uniform vec3  uBottom;
  uniform vec3  uGround;
  uniform float uArousal;
  uniform float uTime;

  varying vec3 vDir;

  void main() {
    float h = vDir.y;

    // Two-stop vertical gradient through a slightly brighter horizon band.
    vec3 c = h > 0.0
      ? mix(uHorizon, uTop, pow(h, 0.7))
      : mix(uHorizon, uBottom, pow(-h, 0.55));

    // A pool of light far below the brain. Pushed down and widened so its
    // gradient never forms a visible edge across the silhouette — a hard
    // horizon line cutting through the object was worse than no floor at all.
    float floorPool = smoothstep(-0.55, -1.0, h);
    c += uGround * floorPool * 0.5;

    // Very broad, very faint directional lift so the scene has a light side.
    float glow = exp(-pow(h * 1.6, 2.0)) * (0.5 + 0.5 * vDir.x);
    c += uHorizon * glow * 0.18;

    // Arousal warms the whole environment.
    // Arousal is the one place a trace of warmth is allowed, and only faintly.
    c += vec3(0.045, 0.012, 0.012) * uArousal;

    gl_FragColor = vec4(c, 1.0);
  }
`;

export function AmbientEnvironment() {
  const highContrast = useUIStore((s) => s.highContrast);

  const { geometry, material } = useMemo(() => {
    const geometry = new SphereGeometry(28, 32, 20);
    const material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: TOP.clone() },
        uHorizon: { value: HORIZON.clone() },
        uBottom: { value: BOTTOM.clone() },
        uGround: { value: GROUND.clone() },
        uArousal: { value: 0 },
        uTime: { value: 0 },
      },
    });
    return { geometry, material };
  }, []);

  useFrame(() => {
    const u = material.uniforms;
    u.uTime.value = renderState.elapsed;
    u.uArousal.value = renderState.arousal;
    // High contrast flattens the backdrop so the brain's own value range wins.
    u.uGround.value.setScalar(highContrast ? 0.02 : 1).multiply(GROUND);
  });

  return (
    <mesh geometry={geometry} material={material} renderOrder={-100} frustumCulled={false} />
  );
}
