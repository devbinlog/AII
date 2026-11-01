/**
 * InteractionEngine tests.
 * Tests mapping, smoothing, click, clamping, and reset.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { InteractionEngine } from "@/lib/engine/interaction/engine";
import type { InteractionMapping } from "@/types/domain";
import type {
  InteractionInputState,
  RuntimeState,
  PointerState,
} from "@/lib/engine/types";

// ============================================================
// Helpers
// ============================================================

function makePointer(overrides: Partial<PointerState> = {}): PointerState {
  return {
    x: 0.5,
    y: 0.5,
    isDown: false,
    dx: 0,
    dy: 0,
    clickThisFrame: false,
    ...overrides,
  };
}

function makeInputs(overrides: Partial<InteractionInputState> = {}): InteractionInputState {
  return {
    audio: null,
    pointer: makePointer(),
    timelineMs: 0,
    scrollY: 0,
    ...overrides,
  };
}

function makeRule(overrides: Partial<InteractionMapping> = {}): InteractionMapping {
  return {
    id: "rule_001",
    objectId: "obj_001",
    input: "audio_bass",
    output: "scale_y",
    inputMin: 0,
    inputMax: 1,
    outputMin: 1,
    outputMax: 1.5,
    easing: "linear",
    smoothing: 0,
    ...overrides,
  };
}

function makeState(objectIds: string[] = ["obj_001"]): RuntimeState {
  const state: RuntimeState = {};
  for (const id of objectIds) {
    state[id] = {
      transform: {
        x: 0, y: 0, z: 0,
        width: 100, height: 100,
        rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
      },
      visible: true,
    };
  }
  return state;
}

// ============================================================
// Tests
// ============================================================

describe("InteractionEngine", () => {
  let engine: InteractionEngine;

  beforeEach(() => {
    engine = new InteractionEngine();
  });

  it("audio_bass → scale_y: bass=0.5 maps to scaleY=1.25 (linear, smoothing=0)", () => {
    const rules = [makeRule()];
    const inputs = makeInputs({
      audio: {
        frequencyData: new Uint8Array(1024),
        bass: 0.5,
        mid: 0,
        treble: 0,
        overall: 0,
        timestamp: 0,
      },
    });
    const result = engine.process(rules, inputs, makeState());
    expect(result["obj_001"]?.transform.scaleY).toBeCloseTo(1.25, 5);
  });

  it("audio_bass → scale_y: bass=0 maps to scaleY=1 (outputMin)", () => {
    const rules = [makeRule()];
    const inputs = makeInputs({
      audio: {
        frequencyData: new Uint8Array(1024),
        bass: 0,
        mid: 0,
        treble: 0,
        overall: 0,
        timestamp: 0,
      },
    });
    const result = engine.process(rules, inputs, makeState());
    expect(result["obj_001"]?.transform.scaleY).toBeCloseTo(1.0, 5);
  });

  it("audio_bass → scale_y: bass=1 maps to scaleY=1.5 (outputMax)", () => {
    const rules = [makeRule()];
    const inputs = makeInputs({
      audio: {
        frequencyData: new Uint8Array(1024),
        bass: 1,
        mid: 0,
        treble: 0,
        overall: 0,
        timestamp: 0,
      },
    });
    const result = engine.process(rules, inputs, makeState());
    expect(result["obj_001"]?.transform.scaleY).toBeCloseTo(1.5, 5);
  });

  it("audio_bass → scale_y with smoothing=0.5: result is between prev and target", () => {
    const rules = [makeRule({ smoothing: 0.5 })];
    const state = makeState();

    // First frame: bass=1, target=1.5, prev=1.5 (defaults to target), result≈1.5
    const inputs1 = makeInputs({
      audio: { frequencyData: new Uint8Array(1024), bass: 1, mid: 0, treble: 0, overall: 0, timestamp: 0 },
    });
    const result1 = engine.process(rules, inputs1, state);
    expect(result1["obj_001"]?.transform.scaleY).toBeCloseTo(1.5, 5);

    // Second frame: bass=0, target=1.0, prev≈1.5 → smoothed should be between 1.0 and 1.5
    const inputs2 = makeInputs({
      audio: { frequencyData: new Uint8Array(1024), bass: 0, mid: 0, treble: 0, overall: 0, timestamp: 16 },
    });
    const result2 = engine.process(rules, inputs2, result1);
    const scaleY = result2["obj_001"]?.transform.scaleY ?? 0;
    expect(scaleY).toBeGreaterThan(1.0);
    expect(scaleY).toBeLessThan(1.5);
  });

  it("pointer_click → particle_count: clickThisFrame=true → particle_count = outputMax", () => {
    const rules = [
      makeRule({
        input: "pointer_click",
        output: "particle_count",
        outputMin: 0,
        outputMax: 200,
        smoothing: 0,
      }),
    ];
    const inputs = makeInputs({
      pointer: makePointer({ clickThisFrame: true }),
    });
    const result = engine.process(rules, inputs, makeState());
    expect(result["obj_001"]?.particleCount).toBe(200);
  });

  it("pointer_click → particle_count: clickThisFrame=false → particle_count = outputMin", () => {
    const rules = [
      makeRule({
        input: "pointer_click",
        output: "particle_count",
        outputMin: 0,
        outputMax: 200,
        smoothing: 0,
      }),
    ];
    const inputs = makeInputs({
      pointer: makePointer({ clickThisFrame: false }),
    });
    const result = engine.process(rules, inputs, makeState());
    expect(result["obj_001"]?.particleCount).toBe(0);
  });

  it("skips rules referencing objects not in state — no error", () => {
    const rules = [makeRule({ objectId: "obj_MISSING" })];
    const inputs = makeInputs({
      audio: { frequencyData: new Uint8Array(1024), bass: 1, mid: 0, treble: 0, overall: 0, timestamp: 0 },
    });
    expect(() => engine.process(rules, inputs, makeState())).not.toThrow();
    const result = engine.process(rules, inputs, makeState());
    expect(result["obj_MISSING"]).toBeUndefined();
  });

  it("opacity output is clamped to 0-1 (value > 1 → 1)", () => {
    const rules = [
      makeRule({
        output: "opacity",
        outputMin: 0,
        outputMax: 2, // would be 2 at bass=1, but clamped
        smoothing: 0,
      }),
    ];
    const inputs = makeInputs({
      audio: { frequencyData: new Uint8Array(1024), bass: 1, mid: 0, treble: 0, overall: 0, timestamp: 0 },
    });
    const result = engine.process(rules, inputs, makeState());
    expect(result["obj_001"]?.transform.opacity).toBeLessThanOrEqual(1);
  });

  it("opacity output is clamped to 0-1 (value < 0 → 0)", () => {
    const rules = [
      makeRule({
        output: "opacity",
        outputMin: -1, // would be -1 at bass=0, but clamped
        outputMax: 1,
        smoothing: 0,
      }),
    ];
    const inputs = makeInputs({
      audio: { frequencyData: new Uint8Array(1024), bass: 0, mid: 0, treble: 0, overall: 0, timestamp: 0 },
    });
    const result = engine.process(rules, inputs, makeState());
    expect(result["obj_001"]?.transform.opacity).toBeGreaterThanOrEqual(0);
  });

  it("reset() clears smoothing state", () => {
    const rules = [makeRule({ smoothing: 0.5 })];

    // Run with bass=1 to build up smoothed state
    const inputs1 = makeInputs({
      audio: { frequencyData: new Uint8Array(1024), bass: 1, mid: 0, treble: 0, overall: 0, timestamp: 0 },
    });
    engine.process(rules, inputs1, makeState());

    // Reset
    engine.reset();

    // After reset with bass=0, first frame should snap to outputMin=1 (no smoothing history)
    const inputs2 = makeInputs({
      audio: { frequencyData: new Uint8Array(1024), bass: 0, mid: 0, treble: 0, overall: 0, timestamp: 0 },
    });
    const result = engine.process(rules, inputs2, makeState());
    // With no prior history, prev defaults to target=1.0, so result=1.0 even with smoothing
    expect(result["obj_001"]?.transform.scaleY).toBeCloseTo(1.0, 5);
  });

  it("does not mutate the input state", () => {
    const rules = [makeRule({ smoothing: 0 })];
    const state = makeState();
    const originalScaleY = state["obj_001"]?.transform.scaleY;

    const inputs = makeInputs({
      audio: { frequencyData: new Uint8Array(1024), bass: 1, mid: 0, treble: 0, overall: 0, timestamp: 0 },
    });
    engine.process(rules, inputs, state);

    // Original state should not be mutated
    expect(state["obj_001"]?.transform.scaleY).toBe(originalScaleY);
  });
});
