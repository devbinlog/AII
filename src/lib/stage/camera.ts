// Camera presets. Every view looks at the stage center.

import type { CameraState, CameraView, Vec3 } from "./types";

export const STAGE_CENTER: Vec3 = [0, 0.8, 0];

export const CAMERA_VIEWS: Record<CameraView, CameraState> = {
  // Front-of-house view from the audience center, looking at stage center
  perspective: { position: [0, 6.5, 11.5], target: STAGE_CENTER },
  // Plan view: tiny Z offset keeps OrbitControls' up-vector stable
  top: { position: [0, 16, 0.01], target: [0, 0, 0] },
  front: { position: [0, 2.2, 14], target: STAGE_CENTER },
  side: { position: [14, 2.2, 0], target: STAGE_CENTER },
};

export const INITIAL_VIEW: CameraView = "perspective";

/** Orbit limits: never below the floor, sensible zoom range. */
export const ORBIT_LIMITS = {
  minDistance: 4,
  maxDistance: 28,
  maxPolarAngle: Math.PI / 2 - 0.05,
  /** Pan target stays near the stage. */
  panRadius: 8,
} as const;

export function clampTarget(target: Vec3, radius: number = ORBIT_LIMITS.panRadius): Vec3 {
  const [x, y, z] = target;
  const d = Math.hypot(x, z);
  const k = d > radius ? radius / d : 1;
  return [x * k, Math.min(4, Math.max(0, y)), z * k];
}
