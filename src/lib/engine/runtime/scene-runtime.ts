/**
 * AII Creative Engine — SceneRuntime
 * Central orchestrator: ties schema, renderer, audio, and interaction together.
 */

import type { SceneSchema } from "@/types/domain";
import type {
  AudioFrame,
  RuntimeState,
  RuntimeSnapshot,
  RendererInterface,
  InteractionInputState,
  EngineEvent,
  EngineEventType,
  RuntimeStatus,
  PointerState,
} from "@/lib/engine/types";
import { InteractionEngine } from "@/lib/engine/interaction/engine";

// ============================================================
// SceneRuntime
// ============================================================

export class SceneRuntime {
  // ── Core playback state ──────────────────────────────────
  private status: RuntimeStatus = "idle";
  private elapsedMs = 0;
  private frameCount = 0;
  private lastFrameTime: number | null = null;
  private rafId: number | null = null;

  // ── Dependencies ────────────────────────────────────────
  private schema: SceneSchema | null = null;
  private renderer: RendererInterface | null = null;
  private mockAudioFn: ((ms: number) => AudioFrame) | null = null;
  private readonly interactionEngine: InteractionEngine;

  // ── Per-frame state ──────────────────────────────────────
  private currentState: RuntimeState = {};
  private pointer: PointerState = {
    x: 0.5,
    y: 0.5,
    isDown: false,
    dx: 0,
    dy: 0,
    clickThisFrame: false,
  };
  private clickPending = false;

  // ── Events ───────────────────────────────────────────────
  private readonly eventListeners: Map<
    EngineEventType,
    Set<(e: EngineEvent) => void>
  > = new Map();

  // ── Diagnostics ─────────────────────────────────────────
  private fpsSamples: number[] = [];
  private lastRenderMs = 0;
  private readonly seed: number;

  constructor(seed = 42) {
    this.seed = seed;
    this.interactionEngine = new InteractionEngine();
  }

  // ============================================================
  // Configuration
  // ============================================================

  setSchema(schema: SceneSchema): void {
    this.schema = schema;
    this.currentState = this._buildInitialState(schema);
    this.interactionEngine.reset();
    // Reset counters only when idle (don't stomp a running playback)
    if (this.status === "idle") {
      this.elapsedMs = 0;
      this.frameCount = 0;
    }
  }

  setRenderer(renderer: RendererInterface): void {
    this.renderer = renderer;
  }

  setMockAudioFn(fn: (elapsedMs: number) => AudioFrame): void {
    this.mockAudioFn = fn;
  }

  // ============================================================
  // Playback
  // ============================================================

  play(): void {
    if (this.schema === null) return;
    this.status = "playing";
    this.lastFrameTime = null; // Will be set on first tick
    this.rafId = requestAnimationFrame(this._tick);
    this._emit({ type: "play", timestamp: performance.now() });
  }

  pause(): void {
    this._cancelRAF();
    this.status = "paused";
    this._emit({ type: "pause", timestamp: performance.now() });
  }

  resume(): void {
    if (this.status !== "paused") return;
    this.status = "playing";
    this.rafId = requestAnimationFrame(this._tick);
    this._emit({ type: "resume", timestamp: performance.now() });
  }

  reset(): void {
    this._cancelRAF();
    this.status = "idle";
    this.elapsedMs = 0;
    this.frameCount = 0;
    this.lastFrameTime = null;
    if (this.schema) {
      this.currentState = this._buildInitialState(this.schema);
    }
    this.interactionEngine.reset();
    // Render a preview frame at t=0
    if (this.schema && this.renderer) {
      this.renderer.render({
        schema: this.schema,
        state: this.currentState,
        audioFrame: null,
        elapsedMs: 0,
        frameCount: 0,
        seed: this.seed,
      });
    }
    this._emit({ type: "reset", timestamp: performance.now() });
  }

  seek(ms: number): void {
    const max = this.schema?.duration ?? Infinity;
    this.elapsedMs = Math.min(Math.max(ms, 0), max);
    this._emit({ type: "seek", timestamp: performance.now(), data: { ms: this.elapsedMs } });
  }

  // ============================================================
  // State
  // ============================================================

  getSnapshot(): RuntimeSnapshot {
    const fps =
      this.fpsSamples.length > 0
        ? this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length
        : 0;
    return {
      status: this.status,
      elapsedMs: this.elapsedMs,
      currentSceneIndex: 0,
      frameCount: this.frameCount,
      fps: Math.round(fps),
      renderTimeMs: Math.round(this.lastRenderMs * 100) / 100,
    };
  }

  getState(): RuntimeState {
    return this.currentState;
  }

  // ============================================================
  // Input
  // ============================================================

  /** Update pointer position (normalized 0-1). */
  setPointerPosition(x: number, y: number): void {
    const dx = x - this.pointer.x;
    const dy = y - this.pointer.y;
    this.pointer = { ...this.pointer, x, y, dx, dy };
  }

  setPointerDown(down: boolean): void {
    this.pointer = { ...this.pointer, isDown: down };
  }

  /** Fires clickThisFrame=true for exactly one tick. */
  triggerClick(x: number, y: number): void {
    this.pointer = { ...this.pointer, x, y };
    this.clickPending = true;
  }

  // ============================================================
  // Events
  // ============================================================

  on(type: EngineEventType, handler: (e: EngineEvent) => void): () => void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(handler);
    return () => {
      this.eventListeners.get(type)?.delete(handler);
    };
  }

  // ============================================================
  // Cleanup
  // ============================================================

  dispose(): void {
    this._cancelRAF();
    this.status = "idle";
    this.renderer?.dispose();
    this.eventListeners.clear();
  }

  // ============================================================
  // Private
  // ============================================================

  private _buildInitialState(schema: SceneSchema): RuntimeState {
    const state: RuntimeState = {};
    for (const obj of schema.objects) {
      state[obj.id] = {
        transform: { ...obj.transform },
        visible: obj.visible,
      };
    }
    return state;
  }

  private _cancelRAF(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private _emit(event: EngineEvent): void {
    const handlers = this.eventListeners.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        handler(event);
      }
    }
  }

  // Arrow function so `this` is preserved when passed to rAF
  private readonly _tick = (timestamp: number): void => {
    if (this.status !== "playing") return;

    const dt =
      this.lastFrameTime !== null
        ? Math.min(timestamp - this.lastFrameTime, 100) // cap at 100ms
        : 0;
    this.lastFrameTime = timestamp;
    this.elapsedMs += dt;
    this.frameCount++;

    // Audio frame
    const audioFrame = this.mockAudioFn ? this.mockAudioFn(this.elapsedMs) : null;

    // Pointer: consume click flag
    const pointer: PointerState = {
      ...this.pointer,
      clickThisFrame: this.clickPending,
    };
    this.clickPending = false;

    const inputs: InteractionInputState = {
      audio: audioFrame,
      pointer,
      timelineMs: this.elapsedMs,
      scrollY: 0,
    };

    // Process interactions and render
    if (this.schema) {
      this.currentState = this.interactionEngine.process(
        this.schema.interactions,
        inputs,
        this.currentState
      );

      if (this.renderer) {
        const t0 = performance.now();
        this.renderer.render({
          schema: this.schema,
          state: this.currentState,
          audioFrame,
          elapsedMs: this.elapsedMs,
          frameCount: this.frameCount,
          seed: this.seed,
        });
        this.lastRenderMs = performance.now() - t0;
      }
    }

    // FPS tracking — rolling average of last 60 samples
    if (dt > 0) {
      this.fpsSamples.push(1000 / dt);
      if (this.fpsSamples.length > 60) this.fpsSamples.shift();
    }

    // Duration check
    if (this.schema?.duration != null && this.elapsedMs >= this.schema.duration) {
      this.status = "ended";
      this._emit({ type: "ended", timestamp: performance.now() });
      return;
    }

    this.rafId = requestAnimationFrame(this._tick);
  };
}
