/**
 * AII Creative Engine — AudioAnalyzer
 * Wraps the Web Audio API AnalyserNode to produce normalized AudioFrame snapshots.
 */

import type { AudioFrame } from "@/lib/engine/types";

export class AudioAnalyzer {
  private analyser: AnalyserNode;
  private dataArray: Uint8Array<ArrayBuffer>;
  private binCount: number;

  // Bin boundary indices (exclusive upper bound)
  private bassEnd: number;
  private midEnd: number;
  private trebleEnd: number;

  // Per-band exponential smoothing state
  private _bass = 0;
  private _mid = 0;
  private _treble = 0;
  private _overall = 0;

  constructor(ctx: AudioContext, fftSize = 2048) {
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = fftSize;
    this.analyser.smoothingTimeConstant = 0.8;

    this.binCount = this.analyser.frequencyBinCount; // fftSize / 2
    this.dataArray = new Uint8Array(this.binCount) as Uint8Array<ArrayBuffer>;

    const sampleRate = ctx.sampleRate;
    const binWidth = sampleRate / fftSize;

    this.bassEnd = Math.floor(250 / binWidth);
    this.midEnd = Math.floor(2000 / binWidth);
    this.trebleEnd = Math.min(Math.floor(16000 / binWidth), this.binCount - 1);
  }

  /** Connect a source node into the analyser. */
  connect(source: AudioNode): void {
    source.connect(this.analyser);
  }

  /** Returns the AnalyserNode for further chaining (e.g. to destination). */
  getDestination(): AudioNode {
    return this.analyser;
  }

  /** Sample the current audio state and return a normalized AudioFrame. */
  getFrame(): AudioFrame {
    this.analyser.getByteFrequencyData(this.dataArray);

    const rawBass = this._averageBins(1, this.bassEnd);
    const rawMid = this._averageBins(this.bassEnd + 1, this.midEnd);
    const rawTreble = this._averageBins(this.midEnd + 1, this.trebleEnd);
    const rawOverall = this._averageBins(0, this.binCount - 1);

    // Per-band exponential smoothing (~100ms response at 60fps with alpha=0.15)
    const alpha = 0.15;
    this._bass = this._bass + alpha * (rawBass - this._bass);
    this._mid = this._mid + alpha * (rawMid - this._mid);
    this._treble = this._treble + alpha * (rawTreble - this._treble);
    this._overall = this._overall + alpha * (rawOverall - this._overall);

    return {
      frequencyData: new Uint8Array(this.dataArray),
      bass: this._bass,
      mid: this._mid,
      treble: this._treble,
      overall: this._overall,
      timestamp: performance.now(),
    };
  }

  /** Disconnect and clean up. */
  dispose(): void {
    this.analyser.disconnect();
  }

  // ── helpers ─────────────────────────────────────────────────

  private _averageBins(startBin: number, endBin: number): number {
    const start = Math.max(0, startBin);
    const end = Math.min(endBin, this.binCount - 1);
    if (start > end) return 0;

    let sum = 0;
    for (let i = start; i <= end; i++) {
      sum += this.dataArray[i] ?? 0;
    }
    return sum / ((end - start + 1) * 255);
  }
}
