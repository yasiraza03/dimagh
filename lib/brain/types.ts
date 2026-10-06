/**
 * Core domain types for dimagh.
 *
 * Everything downstream — the shaders, the simulation engine, the UI — is driven
 * by these shapes, loaded from JSON in /data. Nothing about a specific scenario
 * is hardcoded into a component.
 */

export type RegionCategory =
  | 'sensory'
  | 'visual'
  | 'auditory'
  | 'motor'
  | 'memory'
  | 'emotion'
  | 'attention'
  | 'executive'
  | 'language'
  | 'subcortical'
  | 'arousal'
  | 'effector';

export type PaletteKey =
  | 'cyan'
  | 'orange'
  | 'violet'
  | 'threat'
  | 'blue'
  | 'amber'
  | 'green'
  | 'bone';

export type Lateralisation = 'bilateral' | 'left' | 'right' | 'midline';

export type RegionDepth = 'cortical' | 'subcortical' | 'peripheral' | 'effector';

export type Vec3 = [number, number, number];

export interface BrainRegion {
  id: string;
  name: string;
  /** Short technical label used in the HUD and on 3D labels. */
  abbr: string;
  category: RegionCategory;
  lateralized: Lateralisation;
  /** Normalised brain-space position of the right-side (or midline) instance. */
  position: Vec3;
  radius: number;
  color: PaletteKey;
  depth: RegionDepth;
  summary: string;
  /** "What it does" — responsibly worded. */
  role: string;
  /** "Why it matters" — the interesting consequence. */
  why: string;
  /** Functional systems this region participates in. Never exactly one. */
  systems: string[];
  /** What our visual abstraction hides. Surfaced in Science mode. */
  caveat: string;
  /** Scenario ids where this region plays a visible part. */
  scenarios: string[];
}

export type ConnectionDirection = 'forward' | 'backward' | 'bidirectional';

export type ConnectionProfile =
  | 'fast'
  | 'slow'
  | 'burst'
  | 'sustained'
  | 'modulatory';

export interface BrainConnection {
  id: string;
  source: string;
  target: string;
  direction: ConnectionDirection;
  /** Visualisation weight (0–1), not a measured connectivity value. */
  strength: number;
  category: string;
  profile: ConnectionProfile;
  explanation: string;
}

/** A region instance in world space — bilateral regions produce two. */
export interface RegionInstance {
  region: BrainRegion;
  /** `${region.id}` for single instances, `${region.id}:L` / `:R` for pairs. */
  key: string;
  side: 'left' | 'right' | 'mid';
  position: Vec3;
  /** Index into the activation data texture. */
  slot: number;
}

/** Resolved connection geometry, computed once at module load. */
export interface ConnectionInstance {
  connection: BrainConnection;
  key: string;
  /** Cubic Bézier control points in world space. */
  curve: [Vec3, Vec3, Vec3, Vec3];
  length: number;
  slot: number;
}
