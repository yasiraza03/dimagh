'use client';

/**
 * Miniature animated motifs for the experience cards.
 *
 * These are 2D canvas rather than WebGL, deliberately. Twelve cards would mean
 * twelve WebGL contexts — browsers cap that at around sixteen and start
 * discarding the oldest, which would break the main brain scene. Rendering the
 * same motifs through one shared offscreen WebGL context is possible but adds a
 * lot of machinery for a 180×90 thumbnail.
 *
 * Instead: additive-blended particle fields on a 2D context, all driven by one
 * shared requestAnimationFrame loop, with cards outside the viewport skipped
 * entirely. Every motif encodes the same meaning its scenario does — a stream
 * flows, a burst interrupts, a lattice consolidates.
 */

export type MotifKind =
  | 'radial'
  | 'stream'
  | 'cluster'
  | 'spiral'
  | 'burst'
  | 'lattice'
  | 'wave';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  seed: number;
}

const PARTICLE_COUNT: Record<MotifKind, number> = {
  radial: 56,
  stream: 70,
  cluster: 60,
  spiral: 64,
  burst: 72,
  lattice: 52,
  wave: 66,
};

function rand(seed: number): number {
  const s = Math.sin(seed * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

export class CardMotif {
  private ctx: CanvasRenderingContext2D | null;
  private particles: Particle[] = [];
  private w = 0;
  private h = 0;
  private dpr = 1;
  private t = 0;
  /** Ramps to 1 on hover; motifs intensify rather than switching behaviour. */
  hoverAmount = 0;
  hovered = false;
  visible = true;

  constructor(
    private canvas: HTMLCanvasElement,
    private kind: MotifKind,
    private color: string,
    private reducedMotion = false,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.resize();
    this.seed();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    // Off-screen, collapsed or pre-layout: nothing to size to.
    if (rect.width < 1 || rect.height < 1) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private seed() {
    const n = this.reducedMotion
      ? Math.round(PARTICLE_COUNT[this.kind] * 0.4)
      : PARTICLE_COUNT[this.kind];
    this.particles = Array.from({ length: n }, (_, i) => ({
      x: rand(i + 1) * 1,
      y: rand(i + 7.3) * 1,
      vx: 0,
      vy: 0,
      life: rand(i + 2.1),
      seed: rand(i + 3.7),
    }));
  }

  /**
   * Motif velocity field, in normalised 0–1 space. Each kind is a different
   * flow, which is what makes the thumbnails distinguishable at a glance.
   */
  private field(p: Particle, t: number): [number, number] {
    const cx = 0.5;
    const cy = 0.5;
    switch (this.kind) {
      case 'stream': {
        // Left-to-right flow with gentle vertical banding: a pathway.
        return [0.34, Math.sin(p.x * 7 + t * 0.9 + p.seed * 6) * 0.055];
      }
      case 'radial': {
        // Converging inward: selection.
        const dx = cx - p.x;
        const dy = cy - p.y;
        const d = Math.hypot(dx, dy) || 1e-3;
        return [(dx / d) * 0.19, (dy / d) * 0.19];
      }
      case 'burst': {
        // Periodic outward pulses: interruption.
        const dx = p.x - cx;
        const dy = p.y - cy;
        const d = Math.hypot(dx, dy) || 1e-3;
        const pulse = Math.pow(0.5 + 0.5 * Math.sin(t * 1.9), 8);
        return [(dx / d) * (0.08 + pulse * 0.72), (dy / d) * (0.08 + pulse * 0.72)];
      }
      case 'spiral': {
        const dx = p.x - cx;
        const dy = (p.y - cy) * 0.6;
        const d = Math.hypot(dx, dy) || 1e-3;
        // Tangential plus slight inward: a cycle that does not quite close.
        return [(-dy / d) * 0.26 - (dx / d) * 0.045, (dx / d) * 0.26 - (dy / d) * 0.045];
      }
      case 'cluster': {
        // Orbit one of three attractors: reconstruction from fragments.
        const k = Math.floor(p.seed * 3);
        const ax = 0.28 + k * 0.22;
        const ay = 0.36 + ((k % 2) * 0.28);
        const dx = ax - p.x;
        const dy = ay - p.y;
        const d = Math.hypot(dx, dy) || 1e-3;
        return [(dx / d) * 0.16 - dy * 0.3, (dy / d) * 0.16 + dx * 0.3];
      }
      case 'lattice': {
        // Snap toward a grid: an experience becoming structured.
        const gx = Math.round(p.x * 5) / 5;
        const gy = Math.round(p.y * 3) / 3;
        return [(gx - p.x) * 1.4, (gy - p.y) * 1.4];
      }
      case 'wave':
      default: {
        // Rightward travel with a strong transverse oscillation: sound.
        const amp = 0.12 + Math.sin(t * 0.7 + p.seed * 6.28) * 0.05;
        return [0.26, Math.cos(p.x * 12 + t * 2.4) * amp];
      }
    }
  }

  step(dt: number) {
    const ctx = this.ctx;
    if (!ctx || this.w < 1 || this.h < 1) return;
    if (!this.visible) return;

    this.t += dt;
    const t = this.t;

    const hoverGoal = this.hovered ? 1 : 0;
    this.hoverAmount += (hoverGoal - this.hoverAmount) * Math.min(1, dt * 7);

    const speed = this.reducedMotion ? 0.25 : 0.65 + this.hoverAmount * 0.75;

    // Fade rather than clear: the residue is the trail.
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(4, 5, 7, ${this.reducedMotion ? 0.5 : 0.19})`;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.globalCompositeOperation = 'lighter';

    for (const p of this.particles) {
      const [fx, fy] = this.field(p, t);
      p.vx += (fx - p.vx) * Math.min(1, dt * 6);
      p.vy += (fy - p.vy) * Math.min(1, dt * 6);
      p.x += p.vx * dt * speed;
      p.y += p.vy * dt * speed;
      p.life -= dt * (0.28 + p.seed * 0.22);

      // Respawn when a particle leaves the frame or expires.
      if (p.life <= 0 || p.x < -0.06 || p.x > 1.06 || p.y < -0.06 || p.y > 1.06) {
        p.life = 1;
        switch (this.kind) {
          case 'stream':
          case 'wave':
            p.x = -0.04;
            p.y = 0.2 + rand(p.seed * 91 + t) * 0.6;
            break;
          case 'radial':
            {
              const a = rand(p.seed * 53 + t) * Math.PI * 2;
              p.x = 0.5 + Math.cos(a) * 0.62;
              p.y = 0.5 + Math.sin(a) * 0.52;
            }
            break;
          case 'burst':
            p.x = 0.5 + (rand(p.seed * 31 + t) - 0.5) * 0.08;
            p.y = 0.5 + (rand(p.seed * 17 + t) - 0.5) * 0.08;
            break;
          default:
            p.x = rand(p.seed * 77 + t);
            p.y = rand(p.seed * 23 + t);
        }
        p.vx = 0;
        p.vy = 0;
      }

      const a = Math.min(1, p.life * 1.6) * (0.3 + this.hoverAmount * 0.6);
      const r = 0.6 + p.seed * 1.5;
      ctx.fillStyle = this.color;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(p.x * this.w, p.y * this.h, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  destroy() {
    this.particles = [];
    this.ctx = null;
  }
}

/* ------------------------------------------------------------------ *
 * One shared ticker for every motif on the page.
 * ------------------------------------------------------------------ */

const active = new Set<CardMotif>();
let raf = 0;
let last = 0;

function loop(now: number) {
  raf = requestAnimationFrame(loop);
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 0;
  last = now;
  for (const m of active) m.step(dt);
}

export function registerMotif(m: CardMotif) {
  active.add(m);
  if (!raf) {
    last = 0;
    raf = requestAnimationFrame(loop);
  }
  return () => {
    active.delete(m);
    if (active.size === 0 && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}
