'use client';

import gsap from 'gsap';
import { Vector3, type PerspectiveCamera } from 'three';
import { regionAnchor, region } from '@/lib/brain/atlas';
import type { CameraDirective } from '@/lib/simulation/types';

/**
 * The camera rig.
 *
 * We do not use OrbitControls. A scripted cinematic move and a user drag both
 * want to own the camera transform, and letting them fight produces exactly the
 * jerky, fighting-for-control feel this project is trying to avoid. Instead the
 * rig owns a single spherical state (theta, phi, radius, target) which both
 * GSAP timelines and pointer input write to, and the camera is derived from it.
 *
 * A separate "current" state chases the goal every frame, which gives drag
 * inertia and stops scripted tweens from ever snapping.
 */

interface SphericalState {
  theta: number;
  phi: number;
  radius: number;
  tx: number;
  ty: number;
  tz: number;
}

const PHI_MIN = 0.12;
const PHI_MAX = Math.PI - 0.12;
const RADIUS_MIN = 0.28;
const RADIUS_MAX = 9;
/** Elevation band used when framing a region: never from directly below. */
const FRAME_PHI_MIN = 0.62;
const FRAME_PHI_MAX = 1.92;

/** Natural framing distance for each kind of move. */
const MOVE_DISTANCE: Record<string, number> = {
  focus: 1.25,
  orbit: 1.6,
  overview: 2.55,
  wide: 4.6,
  inside: 0.42,
  follow: 1.1,
};

const MOVE_DURATION: Record<string, number> = {
  focus: 1.5,
  orbit: 2.4,
  overview: 2.2,
  wide: 2.6,
  inside: 2.0,
  follow: 1.0,
};

class CameraRig {
  /** Where the camera is being asked to go. Tweened by GSAP. */
  goal: SphericalState = { theta: 0.62, phi: 1.2, radius: 2.55, tx: 0, ty: 0, tz: 0 };
  /** Where the camera actually is. Chases `goal`. */
  cur: SphericalState = { theta: 0.62, phi: 1.2, radius: 2.55, tx: 0, ty: 0, tz: 0 };

  /** Idle rotation in radians per second. Zero while a move is running. */
  autoOrbit = 0.035;
  /** Suppressed while the user is dragging or a scripted move is in flight. */
  private scripted = false;
  private tween: gsap.core.Tween | null = null;
  /** Reduced-motion collapses every move to a near-instant cut. */
  reducedMotion = false;
  /** Optional per-frame follow target, used by followSignal. */
  private followPoint: Vector3 | null = null;
  private followStrength = 0;

  private tmp = new Vector3();

  /**
   * Screen-space framing offset, in world units along the camera's right and up
   * vectors.
   *
   * Pages put large panels over the canvas — an inspector on the right, an
   * atlas on the left, a transport along the bottom — and the brain, framed
   * dead centre, ends up half behind them. A page declares how much of the
   * viewport it has covered and the rig slides the whole view so the subject
   * sits in the space that is actually visible. Shifting the camera *and* its
   * target keeps the framing identical; only the composition moves.
   */
  framing = { x: 0, y: 0 };
  private framingCur = { x: 0, y: 0 };

  /**
   * @param x positive moves the subject left on screen (clears a right panel)
   * @param y positive moves the subject down (clears a top bar)
   */
  setFraming(x: number, y: number) {
    this.framing.x = x;
    this.framing.y = y;
  }

  get isScripted() {
    return this.scripted;
  }

  /** Set the state immediately with no animation. */
  snap(partial: Partial<SphericalState>) {
    Object.assign(this.goal, partial);
    Object.assign(this.cur, this.goal);
  }

  private animate(to: Partial<SphericalState>, duration: number) {
    this.tween?.kill();
    this.scripted = true;
    const d = this.reducedMotion ? 0.001 : duration;
    // Shortest-path rotation: never spin the long way round.
    if (to.theta != null) {
      let delta = to.theta - this.goal.theta;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      to.theta = this.goal.theta + delta;
    }
    this.tween = gsap.to(this.goal, {
      ...to,
      duration: d,
      ease: 'power3.inOut',
      overwrite: true,
      onComplete: () => {
        this.scripted = false;
      },
    });
  }

  /** Spherical angles that frame a point from outside the brain. */
  private anglesFacing(p: readonly [number, number, number]) {
    const len = Math.hypot(p[0], p[1], p[2]);
    if (len < 1e-3) return { theta: this.goal.theta, phi: this.goal.phi };
    const dir = [p[0] / len, p[1] / len, p[2] / len];
    const theta = Math.atan2(dir[0], dir[2]);
    const phi = Math.acos(Math.max(-1, Math.min(1, dir[1])));
    // Framing a low structure "from outside" means from below, which puts the
    // camera under the brain looking up at its underside — technically correct
    // and useless to look at. Keep the eyeline in a presentable band.
    return {
      theta,
      phi: Math.max(FRAME_PHI_MIN, Math.min(FRAME_PHI_MAX, phi)),
    };
  }

  /** Frame a region from outside, at a readable distance. */
  focusRegion(id: string, duration = MOVE_DURATION.focus, distanceScale = 1) {
    const p = regionAnchor(id);
    const r = region(id);
    const { theta, phi } = this.anglesFacing(p);
    // Framing distance, not proximity. Scaling purely by region radius sent the
    // camera to ~1.1 units for a small region — inside the cerebral envelope,
    // with the brain clipped off every edge of frame. A region is always shown
    // in the context of the whole organ.
    const radius =
      Math.max(1.5, Math.min(2.15, 1.34 + (r?.radius ?? 0.1) * 3.2)) * distanceScale;
    this.followPoint = null;
    this.autoOrbit = 0.01;
    this.animate({ theta, phi, radius, tx: p[0], ty: p[1], tz: p[2] }, duration);
  }

  /** Slowly circle a region while staying pointed at it. */
  orbitRegion(id: string, duration = MOVE_DURATION.orbit, distanceScale = 1) {
    const p = regionAnchor(id);
    const r = region(id);
    const { theta, phi } = this.anglesFacing(p);
    const radius =
      Math.max(1.7, Math.min(2.45, 1.55 + (r?.radius ?? 0.1) * 3.4)) * distanceScale;
    this.followPoint = null;
    this.animate(
      { theta: theta + 0.9, phi: phi * 0.9 + 0.1, radius, tx: p[0], ty: p[1], tz: p[2] },
      duration,
    );
    // Keep drifting after arrival — this is the "being shown something" feel.
    this.autoOrbit = this.reducedMotion ? 0 : 0.11;
  }

  /** The default establishing shot. */
  overview(duration = MOVE_DURATION.overview) {
    this.followPoint = null;
    this.autoOrbit = this.reducedMotion ? 0 : 0.035;
    this.animate(
      { theta: 0.62, phi: 1.2, radius: MOVE_DISTANCE.overview, tx: 0, ty: 0, tz: 0 },
      duration,
    );
  }

  /** Pull right back — used for the closing "living mind" moment. */
  wide(duration = MOVE_DURATION.wide) {
    this.followPoint = null;
    this.autoOrbit = this.reducedMotion ? 0 : 0.05;
    this.animate(
      { theta: 0.3, phi: 1.1, radius: MOVE_DISTANCE.wide, tx: 0, ty: 0, tz: 0 },
      duration,
    );
  }

  /** Dive inside the shell. The micro/macro transition relies on this. */
  enterBrain(id?: string, duration = MOVE_DURATION.inside) {
    const p = id ? regionAnchor(id) : ([0, 0, 0] as const);
    this.followPoint = null;
    this.autoOrbit = this.reducedMotion ? 0 : 0.08;
    this.animate(
      { radius: MOVE_DISTANCE.inside, tx: p[0] * 0.6, ty: p[1] * 0.6, tz: p[2] * 0.6 },
      duration,
    );
  }

  exitBrain(duration = MOVE_DURATION.overview) {
    this.overview(duration);
  }

  /** Microscopic abstraction: all the way in, tight on one region. */
  zoomMicroscopic(id: string, duration = 2.2) {
    const p = regionAnchor(id);
    const { theta, phi } = this.anglesFacing(p);
    this.followPoint = null;
    this.autoOrbit = this.reducedMotion ? 0 : 0.14;
    this.animate({ theta, phi, radius: 0.3, tx: p[0], ty: p[1], tz: p[2] }, duration);
  }

  /**
   * Soft-follow a moving point (a travelling signal). Called every frame, so it
   * must not start a tween — it nudges the goal target instead.
   */
  follow(p: Vector3 | null, strength = 0.9) {
    this.followPoint = p;
    this.followStrength = strength;
    if (p) this.autoOrbit = 0;
  }

  /** Interpret a scenario's camera directive. */
  apply(d: CameraDirective) {
    const dist = d.distance ?? 1;
    switch (d.move) {
      case 'focus':
        if (d.region) this.focusRegion(d.region, d.duration ?? MOVE_DURATION.focus, dist);
        break;
      case 'orbit':
        if (d.region) this.orbitRegion(d.region, d.duration ?? MOVE_DURATION.orbit, dist);
        break;
      case 'inside':
        this.enterBrain(d.region, d.duration ?? MOVE_DURATION.inside);
        break;
      case 'wide':
        this.wide(d.duration ?? MOVE_DURATION.wide);
        break;
      case 'follow':
        // Handled per-frame by the scene; here we just loosen the framing.
        this.animate({ radius: MOVE_DISTANCE.follow * dist }, d.duration ?? 1);
        break;
      case 'overview':
      default:
        this.overview(d.duration ?? MOVE_DURATION.overview);
    }
  }

  /* ---------------- user input ---------------- */

  /**
   * True when the last pointer interaction moved far enough to be a drag.
   * Region picking checks this so that orbiting the brain never also opens an
   * inspector for whatever happened to be under the cursor on release.
   */
  didDrag = false;

  beginDrag() {
    this.tween?.kill();
    this.scripted = false;
    this.followPoint = null;
    this.autoOrbit = 0;
  }

  drag(dx: number, dy: number) {
    this.goal.theta -= dx * 0.0062;
    this.goal.phi = Math.max(PHI_MIN, Math.min(PHI_MAX, this.goal.phi - dy * 0.0062));
  }

  zoom(delta: number) {
    this.tween?.kill();
    this.scripted = false;
    const factor = Math.exp(delta * 0.0014);
    this.goal.radius = Math.max(
      RADIUS_MIN,
      Math.min(RADIUS_MAX, this.goal.radius * factor),
    );
  }

  pan(dx: number, dy: number) {
    // Pan in the camera's screen plane, scaled by distance so it feels constant.
    const s = this.cur.radius * 0.0016;
    const right = [Math.cos(this.cur.theta), 0, -Math.sin(this.cur.theta)];
    this.goal.tx -= right[0] * dx * s;
    this.goal.tz -= right[2] * dx * s;
    this.goal.ty += dy * s;
    this.goal.tx = Math.max(-1.6, Math.min(1.6, this.goal.tx));
    this.goal.ty = Math.max(-1.6, Math.min(1.6, this.goal.ty));
    this.goal.tz = Math.max(-1.8, Math.min(1.8, this.goal.tz));
  }

  /* ---------------- per-frame ---------------- */

  /**
   * Advance the rig and write the result into the camera.
   * Called once per frame from the scene's render loop.
   */
  update(camera: PerspectiveCamera, dt: number) {
    if (this.autoOrbit !== 0 && !this.scripted) {
      this.goal.theta += this.autoOrbit * dt;
    }

    if (this.followPoint) {
      const k = 1 - Math.exp(-dt * 3.2 * this.followStrength);
      this.goal.tx += (this.followPoint.x - this.goal.tx) * k;
      this.goal.ty += (this.followPoint.y - this.goal.ty) * k;
      this.goal.tz += (this.followPoint.z - this.goal.tz) * k;
    }

    // Exponential chase — frame-rate independent, and the source of the weight.
    const k = this.reducedMotion ? 1 : 1 - Math.exp(-dt * 7.5);
    this.cur.theta += (this.goal.theta - this.cur.theta) * k;
    this.cur.phi += (this.goal.phi - this.cur.phi) * k;
    this.cur.radius += (this.goal.radius - this.cur.radius) * k;
    this.cur.tx += (this.goal.tx - this.cur.tx) * k;
    this.cur.ty += (this.goal.ty - this.cur.ty) * k;
    this.cur.tz += (this.goal.tz - this.cur.tz) * k;

    // Ease the framing offset too, so opening a panel slides the brain across
    // rather than snapping it.
    this.framingCur.x += (this.framing.x - this.framingCur.x) * k;
    this.framingCur.y += (this.framing.y - this.framingCur.y) * k;

    const { theta, phi, radius, tx, ty, tz } = this.cur;
    const sinPhi = Math.sin(phi);

    // Camera-right in world space. phi only tilts, so right stays horizontal.
    const rx = Math.cos(theta);
    const rz = -Math.sin(theta);
    const ox = rx * this.framingCur.x;
    const oz = rz * this.framingCur.x;
    const oy = this.framingCur.y;

    camera.position.set(
      tx + ox + radius * sinPhi * Math.sin(theta),
      ty + oy + radius * Math.cos(phi),
      tz + oz + radius * sinPhi * Math.cos(theta),
    );
    this.tmp.set(tx + ox, ty + oy, tz + oz);
    camera.lookAt(this.tmp);

    // Widen the field of view as we get close, which sells "inside" far better
    // than distance alone.
    const targetFov = radius < 1 ? 55 + (1 - radius) * 28 : 46;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * k;
      camera.updateProjectionMatrix();
    }
  }

  /** How far inside the shell we are, 0 = outside, 1 = fully inside. */
  get insideness(): number {
    return Math.max(0, Math.min(1, (1.15 - this.cur.radius) / 0.75));
  }

  dispose() {
    this.tween?.kill();
    this.tween = null;
  }
}

/**
 * One rig per page. Module-level so scenario timelines, the region inspector and
 * the network search can all drive the camera without prop-drilling a ref
 * through the whole tree.
 */
export const rig = new CameraRig();
