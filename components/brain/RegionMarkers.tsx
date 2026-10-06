'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  InstancedBufferAttribute,
  Matrix4,
  MeshBasicMaterial,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type InstancedMesh,
} from 'three';
import { REGION_INSTANCES } from '@/lib/brain/atlas';
import { renderState } from '@/lib/visualization/renderState';
import { lensState } from '@/lib/visualization/lensState';
import { MARKER_FRAG, MARKER_VERT } from '@/lib/visualization/shaders';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import { useBrainStore } from '@/store/brainStore';
import { rig } from '@/lib/visualization/cameraRig';

/**
 * LAYER 2 — region overlays.
 *
 * One InstancedMesh for every region instance, including the mirrored
 * hemisphere twins. Position and scale ride on `instanceMatrix` so three's
 * built-in InstancedMesh raycasting handles hover and click, which is far more
 * reliable than hand-rolling a ray/sphere test and keeps the region inspector
 * wired up with no extra geometry.
 */

const matrix = new Matrix4();
const hitMatrix = new Matrix4();
const scaleVec = new Vector3();
const posVec = new Vector3();

/**
 * How much larger the invisible pick target is than the visible node.
 *
 * Visual size and hit size have to be decoupled. The markers are deliberately
 * small so they do not bury the cortex, but a 2% -of-screen sphere is miserable
 * to hit with a mouse — so picking runs against a separate, larger, non-drawing
 * instanced mesh at the same transforms.
 */
const HIT_SCALE = 2.0;
const HIT_MIN = 0.038;
/**
 * Grace period before a hover is cleared, in milliseconds.
 *
 * Pick targets overlap, so dragging the cursor across the brain fires a rapid
 * out → move → out → move churn as the nearest instance changes. Clearing
 * immediately made the highlight and its label strobe. Clearing is deferred and
 * cancelled by the next hover, so moving between neighbouring regions reads as
 * one continuous hover rather than a gap.
 */
const HOVER_GRACE = 110;

export function RegionMarkers() {
  const meshRef = useRef<InstancedMesh>(null);
  const hitRef = useRef<InstancedMesh>(null);
  const hover = useBrainStore((s) => s.hover);
  const select = useBrainStore((s) => s.select);
  /** Last id written to the store, so pointer-move does not spam it. */
  const lastHover = useRef<string | null>(null);
  const clearTimer = useRef<number | null>(null);

  const count = REGION_INSTANCES.length;

  const geometry = useMemo(() => new SphereGeometry(1, 20, 14), []);
  const hitGeometry = useMemo(() => new SphereGeometry(1, 10, 7), []);
  const hitMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        // Rendered but writes nothing: no colour, no depth. It exists purely as
        // a raycast target, and three only raycasts meshes that are `visible`.
        colorWrite: false,
        depthWrite: false,
        transparent: true,
        opacity: 0,
      }),
    [],
  );

  const { material, stateAttr } = useMemo(() => {
    const colors = new Float32Array(count * 3);
    const states = new Float32Array(count * 4);
    const tmp = new Color();
    REGION_INSTANCES.forEach((inst, i) => {
      tmp.set(PALETTE_HEX[inst.region.color] ?? PALETTE_HEX.cyan);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
      states[i * 4 + 3] = 1;
    });
    const colorAttr = new InstancedBufferAttribute(colors, 3);
    const stateAttr = new InstancedBufferAttribute(states, 4);
    stateAttr.setUsage(35048 /* DynamicDrawUsage */);

    geometry.setAttribute('aColor', colorAttr);
    geometry.setAttribute('aState', stateAttr);

    const material = new ShaderMaterial({
      vertexShader: MARKER_VERT,
      fragmentShader: MARKER_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.8 },
      },
    });
    return { material, stateAttr };
  }, [count, geometry]);

  useFrame(() => {
    const mesh = meshRef.current;
    const hit = hitRef.current;
    if (!mesh) return;

    const { regionAct, regionOnset, regionMask, regionEmphasis } = renderState;
    const arr = stateAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const inst = REGION_INSTANCES[i];
      const slot = inst.slot;
      const level = regionAct[slot];
      const onset = regionOnset[slot];
      const emphasis = regionEmphasis[slot];
      const mask = regionMask[slot];

      // A marker is a node, not a proxy for the region's volume. Scaling by the
      // region radius produced 15cm spheres that buried the cortex; the radius
      // now only modulates a small absolute size. The onset term adds a brief
      // overshoot, which is what makes an arriving signal land.
      const s =
        0.014 +
        inst.region.radius * 0.085 +
        level * 0.022 +
        onset * 0.016 +
        emphasis * 0.01;
      posVec.set(inst.position[0], inst.position[1], inst.position[2]);
      scaleVec.set(s, s, s);
      matrix.makeScale(scaleVec.x, scaleVec.y, scaleVec.z);
      matrix.setPosition(posVec);
      mesh.setMatrixAt(i, matrix);

      if (hit) {
        // Masked-out regions get a zero-size target so they cannot be picked
        // through the cortex while invisible.
        const hs = mask < 0.25 ? 0 : Math.max(HIT_MIN, s * HIT_SCALE);
        hitMatrix.makeScale(hs, hs, hs);
        hitMatrix.setPosition(posVec);
        hit.setMatrixAt(i, hitMatrix);
      }

      arr[i * 4] = level;
      arr[i * 4 + 1] = onset;
      arr[i * 4 + 2] = emphasis;
      arr[i * 4 + 3] = mask;
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (hit) hit.instanceMatrix.needsUpdate = true;
    stateAttr.needsUpdate = true;
    material.uniforms.uTime.value = renderState.elapsed;
    material.uniforms.uOpacity.value = lensState.cur.markerOpacity;
  });

  const commitHover = useCallback(
    (id: string | null) => {
      if (lastHover.current === id) return;
      lastHover.current = id;
      hover(id);
    },
    [hover],
  );

  const cancelClear = useCallback(() => {
    if (clearTimer.current != null) {
      window.clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
  }, []);

  const onMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const id = e.instanceId;
      if (id == null) return;
      e.stopPropagation();
      cancelClear();
      commitHover(REGION_INSTANCES[id]?.region.id ?? null);
    },
    [commitHover, cancelClear],
  );

  const onOut = useCallback(() => {
    cancelClear();
    clearTimer.current = window.setTimeout(() => {
      clearTimer.current = null;
      commitHover(null);
    }, HOVER_GRACE);
  }, [commitHover, cancelClear]);

  useEffect(() => cancelClear, [cancelClear]);

  const onClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      const id = e.instanceId;
      if (id == null) return;
      // Orbiting the brain should not also open an inspector on release.
      if (rig.didDrag) return;
      e.stopPropagation();
      const regionId = REGION_INSTANCES[id]?.region.id;
      if (!regionId) return;
      select(regionId);
      rig.focusRegion(regionId);
    },
    [select],
  );

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, count]}
        frustumCulled={false}
      />
      {/* Invisible pick targets. Rendered last and writing nothing. */}
      <instancedMesh
        ref={hitRef}
        args={[hitGeometry, hitMaterial, count]}
        frustumCulled={false}
        renderOrder={999}
        onPointerMove={onMove}
        onPointerOut={onOut}
        onClick={onClick}
      />
    </>
  );
}
