'use client';

import { create } from 'zustand';
import { DEFAULT_PARAMS, type ParamKey, type SimParams } from '@/lib/simulation/types';

/**
 * Coarse simulation state. Playback *time* deliberately lives in
 * lib/simulation/clock.ts, outside React — see the note there. Everything in
 * this store changes at human frequency, not frame frequency.
 */
interface SimState {
  scenarioId: string | null;
  /** Chosen branch at a scenario's choice point. */
  choiceId: string | null;
  params: SimParams;
  /** Lab dials have been touched — shows the "modified" badge. */
  paramsDirty: boolean;
  /** The outcome card is showing. */
  showOutcome: boolean;
  /** Event id pinned open in the inspector. */
  pinnedEvent: string | null;
  /** Follow the travelling signal with the camera. */
  followSignal: boolean;
  /** Companion panel (the interactive task) is expanded. */
  companionOpen: boolean;

  loadScenario: (id: string) => void;
  choose: (choiceId: string) => void;
  clearChoice: () => void;
  setParam: (k: ParamKey, v: number) => void;
  resetParams: () => void;
  setShowOutcome: (v: boolean) => void;
  pinEvent: (id: string | null) => void;
  toggleFollowSignal: () => void;
  setCompanionOpen: (v: boolean) => void;
}

export const useSimStore = create<SimState>((set) => ({
  scenarioId: null,
  choiceId: null,
  params: { ...DEFAULT_PARAMS },
  paramsDirty: false,
  showOutcome: false,
  pinnedEvent: null,
  followSignal: false,
  companionOpen: true,

  loadScenario: (id) =>
    set({
      scenarioId: id,
      choiceId: null,
      showOutcome: false,
      pinnedEvent: null,
      followSignal: false,
      companionOpen: true,
    }),
  choose: (choiceId) => set({ choiceId }),
  clearChoice: () => set({ choiceId: null }),
  setParam: (k, v) =>
    set((s) => ({
      params: { ...s.params, [k]: Math.max(0, Math.min(1, v)) },
      paramsDirty: true,
    })),
  resetParams: () => set({ params: { ...DEFAULT_PARAMS }, paramsDirty: false }),
  setShowOutcome: (v) => set({ showOutcome: v }),
  pinEvent: (id) => set({ pinnedEvent: id }),
  toggleFollowSignal: () => set((s) => ({ followSignal: !s.followSignal })),
  setCompanionOpen: (v) => set({ companionOpen: v }),
}));
