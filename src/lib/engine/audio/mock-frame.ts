/**
 * AII Creative Engine — Mock Audio Frames
 * Deterministic audio frames for testing — no real AudioContext needed.
 */

import type { AudioFrame } from "@/lib/engine/types";

// ============================================================
// Config type
// ============================================================

export interface MockAudioConfig {
  bass?: number;    // 0-1, default 0
  mid?: number;     // 0-1, default 0
  treble?: number;  // 0-1, default 0
  overall?: number; // 0-1, if omitted computed as mean of bass/mid/treble
}

// ============================================================
// Bin boundaries (mirrors analyzer.ts defaults for 44100Hz / 2048 fftSize)
// ============================================================

const BIN_COUNT = 1024; // frequencyBinCount = fftSize / 2

const BASS_START = 1;
const BASS_END = 11;
const MID_START = 12;
const MID_END = 92;
const TREBLE_START = 93;
const TREBLE_END = 512;

// ============================================================
// Helpers
// ============================================================

function buildFrequencyData(
  bass: number,
  mid: number,
  treble: number
): Uint8Array {
  const data = new Uint8Array(BIN_COUNT);

  const bassVal = Math.round(bass * 255);
  const midVal = Math.round(mid * 255);
  const trebleVal = Math.round(treble * 255);

  for (let i = BASS_START; i <= BASS_END; i++) data[i] = bassVal;
  for (let i = MID_START; i <= MID_END; i++) data[i] = midVal;
  for (let i = TREBLE_START; i <= TREBLE_END; i++) data[i] = trebleVal;

  return data;
}

// ============================================================
// Public API
// ============================================================

/**
 * Create a single deterministic AudioFrame from a config object.
 */
export function createMockAudioFrame(
  config: MockAudioConfig = {},
  timestamp = 0
): AudioFrame {
  const bass = config.bass ?? 0;
  const mid = config.mid ?? 0;
  const treble = config.treble ?? 0;
  const overall = config.overall ?? (bass + mid + treble) / 3;

  return {
    frequencyData: buildFrequencyData(bass, mid, treble),
    bass,
    mid,
    treble,
    overall,
    timestamp,
  };
}

/**
 * Create a sequence of AudioFrames from an array of configs.
 * Each frame's timestamp is index * 16.667ms (≈ 60fps).
 */
export function createTestAudioSequence(
  frames: MockAudioConfig[]
): AudioFrame[] {
  return frames.map((cfg, idx) =>
    createMockAudioFrame(cfg, idx * 16.667)
  );
}

/**
 * Simulate a continuously playing audio signal using sinusoids.
 * Fully deterministic given the same elapsedMs.
 */
export function simulateAudioFrame(elapsedMs: number): AudioFrame {
  const t = elapsedMs / 1000;

  const bass = (Math.sin(t * Math.PI) * 0.5 + 0.5) * 0.8;
  const mid = (Math.sin(t * Math.PI * 1.7 + 0.5) * 0.5 + 0.5) * 0.6;
  const treble = (Math.sin(t * Math.PI * 3.1 + 1.2) * 0.5 + 0.5) * 0.4;
  const overall = (bass + mid + treble) / 3;

  return {
    frequencyData: buildFrequencyData(bass, mid, treble),
    bass,
    mid,
    treble,
    overall,
    timestamp: elapsedMs,
  };
}

/** A silent frame with all values at zero. */
export const SILENT_FRAME: AudioFrame = Object.freeze(
  createMockAudioFrame({}, 0)
);
