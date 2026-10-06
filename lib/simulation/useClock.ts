'use client';

import { useSyncExternalStore } from 'react';
import { clock } from './clock';

/**
 * Subscribe the DOM to playback time.
 *
 * The clock notifies on a ~16 Hz throttle rather than every frame, which is
 * smooth enough to read a timecode and cheap enough that the whole HUD can
 * depend on it. The WebGL layers do not use this at all — they read
 * `clock.time` directly inside useFrame.
 */
export function useClock() {
  return useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getSnapshot);
}
