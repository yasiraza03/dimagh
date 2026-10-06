'use client';

/**
 * The simulation clock.
 *
 * Playback time lives here, in a module singleton, and *not* in React state.
 * The render loop advances it 60 times a second; putting that in a store would
 * re-render every subscriber 60 times a second. Instead the clock notifies
 * listeners on a throttle, and the WebGL layer reads `clock.time` directly
 * inside useFrame with no subscription at all.
 */
class SimClock {
  time = 0;
  playing = false;
  /** Playback rate. Negative values play the scenario backwards. */
  rate = 1;
  duration = 10;
  /** Playback stops here and waits (used for scenario choice points). */
  gate: number | null = null;
  /** True once the clock has reached the end at least once. */
  completed = false;

  private listeners = new Set<() => void>();
  private lastNotify = 0;
  /** UI refresh interval in ms. 60ms ≈ 16 Hz: smooth enough to read. */
  private throttleMs = 60;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  /** Snapshot for useSyncExternalStore. Identity changes only on notify. */
  private snapshot = {
    time: 0,
    playing: false,
    rate: 1,
    duration: 10,
    completed: false,
    gated: false,
  };

  getSnapshot = () => this.snapshot;

  private notify(force = false) {
    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!force && now - this.lastNotify < this.throttleMs) return;
    this.lastNotify = now;
    this.snapshot = {
      time: this.time,
      playing: this.playing,
      rate: this.rate,
      duration: this.duration,
      completed: this.completed,
      gated: this.gate != null && this.time >= this.gate - 0.001,
    };
    for (const fn of this.listeners) fn();
  }

  /** Called from the render loop. `dt` is seconds since the last frame. */
  advance(dt: number) {
    if (!this.playing) return;
    // Clamp dt so a backgrounded tab does not jump the scenario forward.
    const step = Math.min(dt, 1 / 20) * this.rate;
    let t = this.time + step;

    if (this.gate != null && this.time < this.gate && t >= this.gate) {
      t = this.gate;
      this.playing = false;
      this.time = t;
      this.notify(true);
      return;
    }
    if (t >= this.duration) {
      t = this.duration;
      this.playing = false;
      this.completed = true;
      this.time = t;
      this.notify(true);
      return;
    }
    if (t <= 0) {
      t = 0;
      this.playing = false;
      this.time = t;
      this.notify(true);
      return;
    }
    this.time = t;
    this.notify();
  }

  seek(t: number) {
    this.time = Math.max(0, Math.min(this.duration, t));
    this.notify(true);
  }

  play() {
    if (this.gate != null && this.time >= this.gate - 0.001) return;
    if (this.time >= this.duration - 0.001 && this.rate > 0) this.time = 0;
    this.playing = true;
    this.notify(true);
  }

  pause() {
    this.playing = false;
    this.notify(true);
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  setRate(r: number) {
    this.rate = r;
    this.notify(true);
  }

  reverse() {
    this.rate = -Math.abs(this.rate || 1);
    this.playing = true;
    this.notify(true);
  }

  forward() {
    this.rate = Math.abs(this.rate || 1);
    this.notify(true);
  }

  /** Configure for a scenario. Resets time and completion. */
  load(duration: number, gate: number | null = null) {
    this.duration = duration;
    this.gate = gate;
    this.time = 0;
    this.rate = 1;
    this.playing = false;
    this.completed = false;
    this.notify(true);
  }

  /** Release a gate once a choice has been made. */
  openGate() {
    this.gate = null;
    this.notify(true);
  }

  setGate(g: number | null) {
    this.gate = g;
    this.notify(true);
  }
}

export const clock = new SimClock();
