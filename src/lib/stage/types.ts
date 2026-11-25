// 3D Stage Configurator — core types (framework-free, no three.js imports).
import type { PerformerRole } from "./characters";

// Units are meters. The stage floor is the XZ plane at y = 0; +Z points to the audience.

export type Vec3 = [number, number, number];

export type StageItemKind =
  | "performer"   // blue hologram band member
  | "guitar"
  | "bass"
  | "keyboard"
  | "mic"
  | "amplifier"   // locked by default
  | "drums";      // locked by default

export interface StageItem {
  id: string;
  kind: StageItemKind;
  label: string;
  position: Vec3;
  /** Rotation around the vertical axis, radians. */
  rotationY: number;
  locked: boolean;
  /**
   * Performance-member identity for members added beyond the five built-in ones
   * (`mbr-…`). On a performer: who this is. On an instrument: whose instrument it is.
   * It names a performer in the stage lineup, NOT an account or artist membership,
   * and is independent of the stage object `id`. Absent on built-in items.
   */
  memberId?: string;
  /** Explicit role of an added performer. Built-in performers derive it from their id. */
  role?: PerformerRole;
}

export type CameraView = "perspective" | "top" | "front" | "side";

export interface CameraState {
  position: Vec3;
  target: Vec3;
}

/**
 * Platform backline revision (positions of the locked amps/drums).
 * 1 = original (guitar & keys amps audience-left, bass amp right)
 * 2 = 2026-11-18 (each amp behind its player: bass left, guitar & keys right)
 */
export type BacklineVersion = 1 | 2;
export const CURRENT_BACKLINE: BacklineVersion = 2;

export interface StageLayout {
  version: 1;
  artistId: string;
  items: StageItem[];
  updatedAt: string;
  /**
   * Which platform backline this layout was arranged against. Absent on layouts
   * saved before backlines were versioned; see `backlineOf` for how those resolve.
   */
  backlineVersion?: BacklineVersion;
  /**
   * Session roles the artist took off stage in the lineup picker. Their member and
   * instrument are absent from `items`, and additive normalization never re-adds them.
   * Absent = nobody benched (every layout saved before the lineup picker).
   */
  benched?: PerformerRole[];
}

export interface StageBounds {
  /** Half extents of the usable stage area. */
  halfWidth: number; // X
  halfDepth: number; // Z
}

/** Current stage schema version, stored on every published snapshot. */
export const STAGE_SCHEMA_VERSION = 1 as const;

/** Immutable public snapshot of a saved draft layout. */
export interface StageLayoutVersion {
  id: string;
  artistId: string;
  /** 1, 2, 3 … per artist */
  version: number;
  schemaVersion: typeof STAGE_SCHEMA_VERSION;
  items: StageItem[];
  publishedAt: string;
  publishedBy: string;
}

export type StageVisibility = "public" | "unpublished";

/** Per-artist publication state. Fans can read only `publishedVersionId`. */
export interface StagePublication {
  artistId: string;
  visibility: StageVisibility;
  /** null when never published or unpublished */
  publishedVersionId: string | null;
  updatedAt: string;
}
