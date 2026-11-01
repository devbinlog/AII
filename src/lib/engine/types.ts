/**
 * AII Creative Engine — Shared Types
 * Single source of truth for all cross-module engine contracts.
 */

import type { SceneSchema, SceneTransform } from "@/types/domain";

// ============================================================
// Audio
// ============================================================

export interface AudioFrame {
  /** Raw FFT frequency data from Web Audio API AnalyserNode (0-255 per bin) */
  frequencyData: Uint8Array;
  /** Normalized bass energy (20-250 Hz), 0-1 */
  bass: number;
  /** Normalized mid energy (250-2000 Hz), 0-1 */
  mid: number;
  /** Normalized treble energy (2000-16000 Hz), 0-1 */
  treble: number;
  /** Overall RMS energy, 0-1 */
  overall: number;
  /** performance.now() at frame capture */
  timestamp: number;
}

// ============================================================
// Runtime State
// ============================================================

/** Mutable per-frame state for a single SceneObject, separate from its definition */
export interface RuntimeObjectState {
  /** Current transform, may differ from schema due to interaction rules */
  transform: SceneTransform;
  visible: boolean;
  /** Particle system overrides */
  particleCount?: number;
  particleSpeed?: number;
  /** Additive color adjustments (0-360 for hue, 0-2 for brightness) */
  colorHue?: number;
  colorBrightness?: number;
}

/** objectId → mutable state */
export type RuntimeState = Record<string, RuntimeObjectState>;

// ============================================================
// Interaction Input
// ============================================================

export interface PointerState {
  /** 0-1, normalized to canvas width */
  x: number;
  /** 0-1, normalized to canvas height */
  y: number;
  isDown: boolean;
  /** Drag delta per frame, normalized */
  dx: number;
  dy: number;
  /** True only on the frame a click/tap completes */
  clickThisFrame: boolean;
}

export interface InteractionInputState {
  audio: AudioFrame | null;
  pointer: PointerState;
  /** Current playback position in milliseconds */
  timelineMs: number;
  /** 0-1, page scroll */
  scrollY: number;
}

// ============================================================
// Renderer
// ============================================================

export interface RenderParams {
  schema: SceneSchema;
  state: RuntimeState;
  audioFrame: AudioFrame | null;
  /** Total elapsed playback time in ms */
  elapsedMs: number;
  frameCount: number;
  /** Base seed for deterministic random (particle positions etc.) */
  seed: number;
}

export interface RendererInterface {
  render(params: RenderParams): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

// ============================================================
// Runtime
// ============================================================

export type RuntimeStatus = "idle" | "playing" | "paused" | "ended";

export interface RuntimeSnapshot {
  status: RuntimeStatus;
  elapsedMs: number;
  currentSceneIndex: number;
  frameCount: number;
  fps: number;
  renderTimeMs: number;
}

export type EngineEventType =
  | "play"
  | "pause"
  | "resume"
  | "reset"
  | "seek"
  | "scene-change"
  | "ended"
  | "error";

export interface EngineEvent {
  type: EngineEventType;
  timestamp: number;
  data?: unknown;
}
