'use client';

import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { REGION_INSTANCES } from '@/lib/brain/atlas';
import { renderState } from '@/lib/visualization/renderState';
import { lensState } from '@/lib/visualization/lensState';
import { labelConfig, labelSlots, MAX_LABELS } from '@/lib/visualization/labelState';
import { PALETTE_HEX } from '@/lib/visualization/palette';
import { useBrainStore } from '@/store/brainStore';
import { useUIStore } from '@/store/uiStore';

/**
 * LAYER 6 — labels.
 *
 * Names only what the current step is actually about, plus whatever you are
 * pointing at. Nothing else.
 *
 * The earlier version labelled the most *active* regions. That produced nine
 * names on screen at all times — mostly left over from previous steps, since
 * activity decays slowly — and because their ranking changed several times a
 * second, the labels continuously swapped places and rewrote themselves. It
 * read as flicker and told you almost nothing.
 *
 * Labels are also *owned*: a region keeps its slot for as long as it is
 * eligible, so a label never jumps across the screen because something else
 * overtook it.
 */

const v = new Vector3();

/** Dead zone for the in-front / behind test, in world units. */
const DEPTH_MARGIN = 0.14;
/**
 * Seconds a label lingers after its step moves on. Long enough that stepping
 * through a scenario does not strobe, short enough that it stays current.
 */
const LINGER = 0.55;

export function LabelProjector() {
  const { camera, size } = useThree();
  const labelsOn = useUIStore((s) => s.labels);
  const selected = useBrainStore((s) => s.selected);
  const hovered = useBrainStore((s) => s.hovered);

  /** Which region owns each label slot. */
  const slotOwner = useMemo<Array<string | null>>(
    () => Array.from({ length: MAX_LABELS }, () => null),
    [],
  );
  /** region id → wall-clock time it stops being eligible. */
  const until = useMemo(() => new Map<string, number>(), []);
  /** region id → its instance index, resolved once. */
  const instanceOf = useMemo(() => {
    const m = new Map<string, number>();
    REGION_INSTANCES.forEach((inst, i) => {
      // Prefer the right-hand instance of a bilateral pair: one label per
      // region, not a mirrored pair either side of the midline.
      if (!m.has(inst.region.id) || inst.side !== 'left') m.set(inst.region.id, i);
    });
    return m;
  }, []);

  useFrame(() => {
    const enabled = labelsOn && lensState.cur.labels;
    labelConfig.enabled = enabled;
    if (!enabled) {
      for (let n = 0; n < MAX_LABELS; n++) {
        slotOwner[n] = null;
        if (labelSlots[n].opacity !== 0) labelSlots[n].opacity = 0;
      }
      labelConfig.version++;
      return;
    }

    const now = renderState.elapsed;
    const { regionAct, regionMask } = renderState;

    // --- who deserves a name right now -------------------------------------
    for (const id of renderState.focusRegions) until.set(id, now + LINGER);
    if (hovered) until.set(hovered, now + LINGER);
    if (selected) until.set(selected, now + LINGER);

    const eligible = (id: string): boolean => {
      if (id === hovered || id === selected) return true;
      const t = until.get(id);
      if (t == null) return false;
      if (t < now) {
        until.delete(id);
        return false;
      }
      const index = instanceOf.get(id);
      if (index == null) return false;
      // A region the lens has hidden should not be named.
      return regionMask[REGION_INSTANCES[index].slot] >= 0.3;
    };

    // --- release slots whose owner has dropped out --------------------------
    for (let n = 0; n < MAX_LABELS; n++) {
      const owner = slotOwner[n];
      if (owner && !eligible(owner)) {
        slotOwner[n] = null;
        labelSlots[n].opacity = 0;
      }
    }

    // --- fill free slots ----------------------------------------------------
    const owned = new Set(slotOwner.filter(Boolean) as string[]);
    const wants: string[] = [];
    if (selected && !owned.has(selected)) wants.push(selected);
    if (hovered && hovered !== selected && !owned.has(hovered)) wants.push(hovered);
    for (const id of renderState.focusRegions) {
      if (!owned.has(id) && !wants.includes(id)) wants.push(id);
    }
    for (const id of until.keys()) {
      if (!owned.has(id) && !wants.includes(id) && eligible(id)) wants.push(id);
    }

    for (const id of wants) {
      const free = slotOwner.indexOf(null);
      if (free === -1) break;
      if (!eligible(id)) continue;
      slotOwner[free] = id;
      owned.add(id);
    }

    // --- place them ---------------------------------------------------------
    const camDist = camera.position.length();

    for (let n = 0; n < MAX_LABELS; n++) {
      const slot = labelSlots[n];
      const owner = slotOwner[n];
      if (!owner) {
        slot.opacity = 0;
        continue;
      }
      const index = instanceOf.get(owner);
      if (index == null) {
        slot.opacity = 0;
        continue;
      }

      const inst = REGION_INSTANCES[index];
      v.set(inst.position[0], inst.position[1], inst.position[2]);
      // Nudge the anchor toward the viewer so labels sit off the surface.
      v.multiplyScalar(1.12);
      const depth = v.distanceTo(camera.position);
      v.project(camera);

      if (v.z > 1 || v.z < -1) {
        slot.opacity = 0;
        continue;
      }

      slot.regionId = inst.region.id;
      slot.abbr = inst.region.abbr;
      slot.name = inst.region.name;
      slot.x = (v.x * 0.5 + 0.5) * size.width;
      slot.y = (-v.y * 0.5 + 0.5) * size.height;
      slot.level = regionAct[inst.slot];
      slot.emphasised = inst.region.id === selected || inst.region.id === hovered;

      /*
       * Is the anchor on the far side of the brain? Compared against the
       * camera's distance to the centre — and for a region *near* the centre
       * the two are nearly identical, so without a dead zone this flag flipped
       * every frame as the camera drifted and strobed the label's opacity.
       */
      slot.behind = slot.behind
        ? depth > camDist - DEPTH_MARGIN
        : depth > camDist + DEPTH_MARGIN;

      slot.color = PALETTE_HEX[inst.region.color] ?? PALETTE_HEX.cyan;
      // Fixed per state, never a function of the activity level: tying opacity
      // to a value that oscillates makes every label pulse.
      slot.opacity = (slot.emphasised ? 1 : 0.85) * (slot.behind ? 0.45 : 1);
    }

    labelConfig.version++;
  });

  return null;
}
