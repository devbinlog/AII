// 3D Stage Configurator — core types (framework-free, no three.js imports).
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
}

export type CameraView = "perspective" | "top" | "front" | "side";

export interface CameraState {
  position: Vec3;
  target: Vec3;
}

export interface StageLayout {
  version: 1;
  artistId: string;
  items: StageItem[];
  updatedAt: string;
}

export interface StageBounds {
  /** Half extents of the usable stage area. */
  halfWidth: number; // X
  halfDepth: number; // Z
}
