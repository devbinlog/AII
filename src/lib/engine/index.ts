/**
 * AII Creative Engine — Public API
 * Re-exports all stable engine contracts from a single entry point.
 */

// ── Types ─────────────────────────────────────────────────────
export type {
  AudioFrame,
  RuntimeObjectState,
  RuntimeState,
  InteractionInputState,
  RenderParams,
  RendererInterface,
  RuntimeStatus,
  RuntimeSnapshot,
  EngineEvent,
  EngineEventType,
} from "./types";

// ── Schema validation ─────────────────────────────────────────
export { validateSceneSchema } from "./schema";

// ── Renderer ─────────────────────────────────────────────────
export { Canvas2DRenderer } from "./renderer/canvas2d";

// ── Audio ─────────────────────────────────────────────────────
export { AudioAnalyzer } from "./audio/analyzer";
export {
  createMockAudioFrame,
  simulateAudioFrame,
  createTestAudioSequence,
  SILENT_FRAME,
} from "./audio/mock-frame";

// ── Interaction ───────────────────────────────────────────────
export { InteractionEngine } from "./interaction/engine";

// ── Runtime ───────────────────────────────────────────────────
export { SceneRuntime } from "./runtime/scene-runtime";
export { createRNG, mulberry32 } from "./runtime/rng";
