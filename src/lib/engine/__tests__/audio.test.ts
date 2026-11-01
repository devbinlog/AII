/**
 * Audio mock frame tests.
 * All functions are deterministic — no real AudioContext needed.
 */

import { describe, it, expect } from "vitest";
import {
  simulateAudioFrame,
  createMockAudioFrame,
  createTestAudioSequence,
  SILENT_FRAME,
} from "@/lib/engine/audio/mock-frame";

// ============================================================
// simulateAudioFrame
// ============================================================

describe("simulateAudioFrame", () => {
  it("returns AudioFrame with all values in 0-1", () => {
    const frame = simulateAudioFrame(0);
    expect(frame.bass).toBeGreaterThanOrEqual(0);
    expect(frame.bass).toBeLessThanOrEqual(1);
    expect(frame.mid).toBeGreaterThanOrEqual(0);
    expect(frame.mid).toBeLessThanOrEqual(1);
    expect(frame.treble).toBeGreaterThanOrEqual(0);
    expect(frame.treble).toBeLessThanOrEqual(1);
    expect(frame.overall).toBeGreaterThanOrEqual(0);
    expect(frame.overall).toBeLessThanOrEqual(1);
  });

  it("returns different values at t=500ms vs t=0", () => {
    const f0 = simulateAudioFrame(0);
    const f500 = simulateAudioFrame(500);
    // At least one channel should differ
    const differs =
      f0.bass !== f500.bass ||
      f0.mid !== f500.mid ||
      f0.treble !== f500.treble;
    expect(differs).toBe(true);
  });

  it("is deterministic: same elapsed ms produces same values", () => {
    const a = simulateAudioFrame(1000);
    const b = simulateAudioFrame(1000);
    expect(a.bass).toBe(b.bass);
    expect(a.mid).toBe(b.mid);
    expect(a.treble).toBe(b.treble);
    expect(a.overall).toBe(b.overall);
  });

  it("includes frequencyData with correct length", () => {
    const frame = simulateAudioFrame(0);
    expect(frame.frequencyData).toBeInstanceOf(Uint8Array);
    expect(frame.frequencyData.length).toBe(1024);
  });

  it("timestamp equals elapsedMs", () => {
    const frame = simulateAudioFrame(2500);
    expect(frame.timestamp).toBe(2500);
  });
});

// ============================================================
// createMockAudioFrame
// ============================================================

describe("createMockAudioFrame", () => {
  it("sets bass correctly", () => {
    const frame = createMockAudioFrame({ bass: 1 });
    expect(frame.bass).toBe(1);
  });

  it("defaults to 0 when no config", () => {
    const frame = createMockAudioFrame();
    expect(frame.bass).toBe(0);
    expect(frame.mid).toBe(0);
    expect(frame.treble).toBe(0);
  });

  it("computes overall as mean of bass/mid/treble when not specified", () => {
    const frame = createMockAudioFrame({ bass: 0.6, mid: 0.3, treble: 0.0 });
    expect(frame.overall).toBeCloseTo(0.3, 5);
  });

  it("uses explicit overall when provided", () => {
    const frame = createMockAudioFrame({ bass: 1, mid: 1, treble: 1, overall: 0.5 });
    expect(frame.overall).toBe(0.5);
  });

  it("frequencyData has non-zero values in bass range when bass > 0", () => {
    const frame = createMockAudioFrame({ bass: 0.5 });
    // Bass bins: 1-11
    const bassSum = Array.from(frame.frequencyData.slice(1, 12)).reduce(
      (a, b) => a + b, 0
    );
    expect(bassSum).toBeGreaterThan(0);
  });

  it("frequencyData is zero in bass range when bass = 0", () => {
    const frame = createMockAudioFrame({ bass: 0 });
    const bassSum = Array.from(frame.frequencyData.slice(1, 12)).reduce(
      (a, b) => a + b, 0
    );
    expect(bassSum).toBe(0);
  });

  it("uses provided timestamp", () => {
    const frame = createMockAudioFrame({}, 9999);
    expect(frame.timestamp).toBe(9999);
  });
});

// ============================================================
// SILENT_FRAME
// ============================================================

describe("SILENT_FRAME", () => {
  it("has all zero energy values", () => {
    expect(SILENT_FRAME.bass).toBe(0);
    expect(SILENT_FRAME.mid).toBe(0);
    expect(SILENT_FRAME.treble).toBe(0);
    expect(SILENT_FRAME.overall).toBe(0);
  });

  it("has frequencyData of all zeros", () => {
    const nonZero = Array.from(SILENT_FRAME.frequencyData).some((v) => v !== 0);
    expect(nonZero).toBe(false);
  });

  it("is frozen (immutable)", () => {
    expect(Object.isFrozen(SILENT_FRAME)).toBe(true);
  });
});

// ============================================================
// createTestAudioSequence
// ============================================================

describe("createTestAudioSequence", () => {
  it("generates the correct number of frames", () => {
    const frames = createTestAudioSequence([
      { bass: 0.1 },
      { bass: 0.2 },
      { bass: 0.3 },
    ]);
    expect(frames.length).toBe(3);
  });

  it("timestamps are sequential and ~16.667ms apart", () => {
    const frames = createTestAudioSequence([{}, {}, {}]);
    expect(frames[0]?.timestamp).toBeCloseTo(0, 3);
    expect(frames[1]?.timestamp).toBeCloseTo(16.667, 2);
    expect(frames[2]?.timestamp).toBeCloseTo(33.334, 1);
  });

  it("applies config values to each frame", () => {
    const frames = createTestAudioSequence([{ bass: 0.8 }, { bass: 0.2 }]);
    expect(frames[0]?.bass).toBe(0.8);
    expect(frames[1]?.bass).toBe(0.2);
  });

  it("returns empty array for empty input", () => {
    expect(createTestAudioSequence([])).toEqual([]);
  });
});
