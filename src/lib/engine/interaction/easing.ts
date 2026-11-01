/**
 * AII Creative Engine — Easing & Math Utilities
 * Pure, dependency-free math helpers for the interaction engine.
 */

// ============================================================
// Types
// ============================================================

export type EasingType = "linear" | "ease_in" | "ease_out" | "ease_in_out";

// ============================================================
// Core math
// ============================================================

/** Clamp value to [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Clamp value to [0, 1]. */
export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/**
 * Normalize a value from the range [min, max] to [0, 1].
 * Returns 0 when min === max (avoids division by zero).
 */
export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return clamp01((value - min) / (max - min));
}

/** Linear interpolation between a and b by factor t. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ============================================================
// Easing
// ============================================================

/**
 * Apply an easing curve to a normalized t value (0-1).
 * Input is expected to already be clamped; output is in [0, 1].
 */
export function applyEasing(t: number, type: EasingType): number {
  switch (type) {
    case "linear":
      return t;

    case "ease_in":
      return t * t;

    case "ease_out":
      return t * (2 - t);

    case "ease_in_out":
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    default: {
      // exhaustive guard — keeps TypeScript happy when new variants are added
      const _: never = type;
      void _;
      return t;
    }
  }
}
