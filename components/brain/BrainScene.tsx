'use client';

import { Suspense, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import clsx from 'clsx';
import { ACESFilmicToneMapping } from 'three';
import { BrainModel } from './BrainModel';
import { BrainConnections } from './BrainConnections';
import { RegionMarkers } from './RegionMarkers';
import { SignalParticles } from './SignalParticles';
import { NeuralDust } from './NeuralDust';
import { AmbientEnvironment } from './AmbientEnvironment';
import { LabelProjector } from './LabelProjector';
import { SceneEffects } from './SceneEffects';
import { SimDriver } from '@/components/simulation/SimDriver';
import { BrainLabelOverlay } from '@/components/ui/BrainLabelOverlay';
import { detailForSegments } from '@/lib/visualization/brainGeometry';
import { rig } from '@/lib/visualization/cameraRig';
import { QUALITY_BUDGET, useUIStore } from '@/store/uiStore';
import { useBrainStore } from '@/store/brainStore';

/**
 * The brain scene.
 *
 * Owns the Canvas, the pointer gestures that drive the camera rig, and the
 * composition of the seven render layers. Pointer handling lives on the wrapper
 * div rather than inside R3F so that an orbit gesture and a region pick cannot
 * compete for the same event — the rig records whether the pointer moved, and
 * region picking checks that before acting.
 */

interface Props {
  /** Extra 3D content (scenario companions, stimuli). */
  children?: ReactNode;
  /** Hide the DOM label overlay (used by small inline scenes). */
  labels?: boolean;
  /**
   * Whether this scene owns the wheel and touch gestures.
   *
   * On a dedicated viewer (brain, network, a scenario) the answer is yes: the
   * wheel zooms the camera and touch drags orbit, so both are captured.
   *
   * On a scroll-driven page the canvas is a full-viewport *background*, which
   * means the wheel target over most of the screen is the canvas. Capturing
   * there would swallow the page scroll entirely. In background mode the scene
   * keeps pointer-drag orbiting but leaves wheel and vertical touch to the
   * document.
   */
  interactive?: boolean;
  /**
   * True when the page around this scene scrolls. A full-viewport viewer with
   * nothing to scroll can safely claim vertical touch for orbiting; a canvas
   * embedded in a scrolling page must hand vertical swipes back, or a phone
   * user cannot get past it.
   */
  scrollable?: boolean;
  className?: string;
}

const DRAG_THRESHOLD = 4;

export function BrainScene({
  children,
  labels = true,
  interactive = true,
  scrollable = false,
  className,
}: Props) {
  const quality = useUIStore((s) => s.quality);
  const reducedMotion = useUIStore((s) => s.reducedMotion);
  const hover = useBrainStore((s) => s.hover);
  const budget = QUALITY_BUDGET[quality];
  const detail = detailForSegments(budget.brainSegments);

  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, x: 0, y: 0, dist: 0, pan: false });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Middle button or shift+drag pans; everything else orbits.
    drag.current = {
      active: true,
      x: e.clientX,
      y: e.clientY,
      dist: 0,
      pan: e.button === 1 || e.shiftKey,
    };
    rig.didDrag = false;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    d.dist += Math.abs(dx) + Math.abs(dy);
    if (d.dist < DRAG_THRESHOLD) return;
    if (!rig.didDrag) {
      rig.didDrag = true;
      rig.beginDrag();
    }
    if (d.pan) rig.pan(dx, dy);
    else rig.drag(dx, dy);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    drag.current.active = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    // Cleared on the next frame so the click handler still sees it.
    requestAnimationFrame(() => {
      rig.didDrag = false;
    });
  }, []);

  const onPointerLeave = useCallback(() => {
    drag.current.active = false;
    hover(null);
  }, [hover]);

  // Wheel zoom. Registered natively because React's onWheel is passive and
  // cannot preventDefault, which would let the page scroll while zooming.
  // Skipped entirely in background mode — see the `interactive` prop.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      rig.zoom(e.deltaY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [interactive]);

  // Two-finger pinch zoom on touch devices.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !interactive) return;
    let last = 0;
    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) last = dist(e.touches);
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const d = dist(e.touches);
      rig.zoom((last - d) * 2.2);
      last = d;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
    };
  }, [interactive]);

  return (
    <div
      ref={containerRef}
      className={clsx(
        className ?? 'absolute inset-0',
        // Background mode is strictly decorative: no orbiting, no region
        // picking, and crucially nothing that competes with selecting text or
        // scrolling the page it sits behind.
        !interactive && 'pointer-events-none',
      )}
      onPointerDown={interactive ? onPointerDown : undefined}
      onPointerMove={interactive ? onPointerMove : undefined}
      onPointerUp={interactive ? onPointerUp : undefined}
      onPointerLeave={interactive ? onPointerLeave : undefined}
      // `none` lets a touch drag orbit in any direction; `pan-y` hands vertical
      // swipes back to the document so the page can still be scrolled over the
      // canvas. Horizontal drag and pinch keep working either way.
      style={{ touchAction: interactive && !scrollable ? 'none' : 'pan-y' }}
    >
      <Canvas
        dpr={budget.dpr}
        camera={{ position: [2.2, 1.2, 2.2], fov: 46, near: 0.01, far: 60 }}
        gl={{
          antialias: quality !== 'low',
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
          depth: true,
        }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.setClearColor('#040507', 1);
          scene.matrixWorldAutoUpdate = true;
        }}
      >
        <SimDriver />
        <LabelProjector />

        <Suspense fallback={null}>
          <AmbientEnvironment />
          <BrainModel detail={detail} />
          <BrainConnections segments={budget.connectionSegments} />
          <RegionMarkers />
          <SignalParticles budget={budget.signalParticles} />
          <NeuralDust budget={budget.dustParticles} />
          {children}
        </Suspense>

        {budget.postprocessing && !reducedMotion ? <SceneEffects /> : null}
      </Canvas>

      {labels ? <BrainLabelOverlay /> : null}
    </div>
  );
}
