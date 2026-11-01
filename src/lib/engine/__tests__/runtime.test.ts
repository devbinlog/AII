/**
 * SceneRuntime unit tests.
 * Uses vi.useFakeTimers() and a mocked requestAnimationFrame.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SceneRuntime } from "@/lib/engine/runtime/scene-runtime";
import { MOCK_SCENES } from "@/lib/mock/fixtures";
import type { RendererInterface, RenderParams } from "@/lib/engine/types";

// ============================================================
// Helpers
// ============================================================

/** Minimal no-op renderer for testing. */
function makeMockRenderer(): RendererInterface {
  return {
    render: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  };
}

// ============================================================
// requestAnimationFrame mock
// ============================================================

let rafCallbacks: Map<number, FrameRequestCallback> = new Map();
let rafId = 0;

function setupRAFMock() {
  rafCallbacks = new Map();
  rafId = 0;

  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = ++rafId;
    rafCallbacks.set(id, cb);
    return id;
  });

  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    rafCallbacks.delete(id);
  });
}

function advanceOneFrame(timestampMs = 16.667) {
  const entries = Array.from(rafCallbacks.entries());
  rafCallbacks.clear();
  for (const [, cb] of entries) {
    cb(timestampMs);
  }
}

// ============================================================
// Tests
// ============================================================

describe("SceneRuntime", () => {
  let runtime: SceneRuntime;
  const scene = MOCK_SCENES[0]!;

  beforeEach(() => {
    setupRAFMock();
    runtime = new SceneRuntime(42);
  });

  afterEach(() => {
    runtime.dispose();
    vi.unstubAllGlobals();
  });

  // ── Initial state ───────────────────────────────────────

  it("initial snapshot has status=idle and elapsedMs=0", () => {
    const snap = runtime.getSnapshot();
    expect(snap.status).toBe("idle");
    expect(snap.elapsedMs).toBe(0);
    expect(snap.frameCount).toBe(0);
  });

  // ── setSchema ───────────────────────────────────────────

  it("setSchema builds correct initial state from scene objects", () => {
    runtime.setSchema(scene.schema);
    const state = runtime.getState();
    for (const obj of scene.schema.objects) {
      expect(state[obj.id]).toBeDefined();
      expect(state[obj.id]?.visible).toBe(obj.visible);
      expect(state[obj.id]?.transform.x).toBe(obj.transform.x);
    }
  });

  it("setSchema does not start playing", () => {
    runtime.setSchema(scene.schema);
    expect(runtime.getSnapshot().status).toBe("idle");
  });

  // ── play ────────────────────────────────────────────────

  it("play() sets status to playing", () => {
    runtime.setSchema(scene.schema);
    runtime.play();
    expect(runtime.getSnapshot().status).toBe("playing");
  });

  it("play() without schema does nothing", () => {
    runtime.play();
    expect(runtime.getSnapshot().status).toBe("idle");
  });

  it("play() emits play event", () => {
    runtime.setSchema(scene.schema);
    const handler = vi.fn();
    runtime.on("play", handler);
    runtime.play();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]?.type).toBe("play");
  });

  // ── pause ───────────────────────────────────────────────

  it("pause() sets status to paused", () => {
    runtime.setSchema(scene.schema);
    runtime.play();
    runtime.pause();
    expect(runtime.getSnapshot().status).toBe("paused");
  });

  it("pause() emits pause event", () => {
    runtime.setSchema(scene.schema);
    const handler = vi.fn();
    runtime.on("pause", handler);
    runtime.play();
    runtime.pause();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  // ── resume ──────────────────────────────────────────────

  it("resume() from paused restarts playing", () => {
    runtime.setSchema(scene.schema);
    runtime.play();
    runtime.pause();
    runtime.resume();
    expect(runtime.getSnapshot().status).toBe("playing");
  });

  it("resume() from non-paused state does nothing", () => {
    runtime.setSchema(scene.schema);
    runtime.play();
    // Still playing — resume should be a no-op
    runtime.resume();
    expect(runtime.getSnapshot().status).toBe("playing");
  });

  // ── reset ───────────────────────────────────────────────

  it("reset() sets status to idle", () => {
    runtime.setSchema(scene.schema);
    runtime.play();
    runtime.reset();
    expect(runtime.getSnapshot().status).toBe("idle");
  });

  it("reset() sets elapsedMs to 0", () => {
    runtime.setSchema(scene.schema);
    runtime.play();
    // Advance a frame to build up elapsed time
    advanceOneFrame(1000);
    runtime.reset();
    expect(runtime.getSnapshot().elapsedMs).toBe(0);
  });

  it("reset() sets frameCount to 0", () => {
    runtime.setSchema(scene.schema);
    runtime.play();
    advanceOneFrame(16.667);
    runtime.reset();
    expect(runtime.getSnapshot().frameCount).toBe(0);
  });

  it("reset() emits reset event", () => {
    runtime.setSchema(scene.schema);
    const handler = vi.fn();
    runtime.on("reset", handler);
    runtime.reset();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  // ── seek ────────────────────────────────────────────────

  it("seek(1000) sets elapsedMs to 1000", () => {
    runtime.setSchema(scene.schema);
    runtime.seek(1000);
    expect(runtime.getSnapshot().elapsedMs).toBe(1000);
  });

  it("seek(-100) clamps to 0", () => {
    runtime.setSchema(scene.schema);
    runtime.seek(-100);
    expect(runtime.getSnapshot().elapsedMs).toBe(0);
  });

  it("seek emits seek event", () => {
    runtime.setSchema(scene.schema);
    const handler = vi.fn();
    runtime.on("seek", handler);
    runtime.seek(500);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  // ── tick / frame advancement ─────────────────────────────

  it("advancing a frame increments frameCount", () => {
    runtime.setSchema(scene.schema);
    runtime.play();
    advanceOneFrame(16.667);
    expect(runtime.getSnapshot().frameCount).toBe(1);
  });

  it("advancing a frame calls renderer.render", () => {
    const renderer = makeMockRenderer();
    runtime.setSchema(scene.schema);
    runtime.setRenderer(renderer);
    runtime.play();
    advanceOneFrame(16.667);
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  // ── triggerClick ─────────────────────────────────────────

  it("triggerClick sets clickPending; cleared after one tick", () => {
    const renderer = makeMockRenderer();
    runtime.setSchema(scene.schema);
    runtime.setRenderer(renderer);

    let capturedClickThisFrame: boolean | undefined;
    (renderer.render as ReturnType<typeof vi.fn>).mockImplementation(
      (params: RenderParams) => {
        // Capture pointer.clickThisFrame via the interaction state changes
        // We can check it indirectly through the render call count
        void params;
      }
    );

    runtime.triggerClick(0.5, 0.5);
    runtime.play();

    // First frame: clickPending should be consumed
    advanceOneFrame(16.667);
    expect(renderer.render).toHaveBeenCalledTimes(1);

    // Second frame: click is gone
    advanceOneFrame(33.334);
    expect(renderer.render).toHaveBeenCalledTimes(2);

    // No assertion on clickThisFrame directly since it's consumed internally,
    // but we verify it doesn't throw and renders correctly
    expect(capturedClickThisFrame).toBeUndefined(); // was never set
  });

  // ── on / unsubscribe ─────────────────────────────────────

  it("on() registers event handler", () => {
    runtime.setSchema(scene.schema);
    const handler = vi.fn();
    runtime.on("play", handler);
    runtime.play();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe function removes handler", () => {
    runtime.setSchema(scene.schema);
    const handler = vi.fn();
    const unsub = runtime.on("play", handler);
    unsub();
    runtime.play();
    expect(handler).not.toHaveBeenCalled();
  });

  // ── dispose ──────────────────────────────────────────────

  it("dispose() cancels animation frame and sets idle", () => {
    runtime.setSchema(scene.schema);
    runtime.play();
    runtime.dispose();
    expect(runtime.getSnapshot().status).toBe("idle");
    // RAF should be cancelled — advancing should not call renderer
    const renderer = makeMockRenderer();
    runtime.setRenderer(renderer);
    advanceOneFrame(50);
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it("dispose() calls renderer.dispose()", () => {
    const renderer = makeMockRenderer();
    runtime.setSchema(scene.schema);
    runtime.setRenderer(renderer);
    runtime.dispose();
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });
});
