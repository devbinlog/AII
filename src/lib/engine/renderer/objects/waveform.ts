/**
 * AII Creative Engine — Waveform Renderer
 * Renders audio frequency data as bars, wave, or circular visualization.
 * Draw centered at (0,0); caller sets up the transform context.
 */

import type { SceneObject } from "@/types/domain";
import type { AudioFrame } from "@/lib/engine/types";

// ============================================================
// Helpers
// ============================================================

/**
 * Sample `count` evenly spaced bins from the first 50% of frequencyData.
 * Returns normalized values 0-1.
 */
function sampleFrequencyData(
  frequencyData: Uint8Array,
  count: number,
): number[] {
  if (frequencyData.length === 0 || count === 0) {
    return Array.from({ length: count }, () => 0);
  }

  // Use only the first 50% of bins (musical content range)
  const usableBins = Math.floor(frequencyData.length * 0.5);
  const result: number[] = new Array(count) as number[];

  for (let i = 0; i < count; i++) {
    const binIndex = Math.floor((i / count) * usableBins);
    const raw = frequencyData[binIndex] ?? 0;
    result[i] = raw / 255;
  }

  return result;
}

// ============================================================
// renderWaveform
// ============================================================

export function renderWaveform(
  ctx: CanvasRenderingContext2D,
  obj: SceneObject,
  audioFrame: AudioFrame | null,
): void {
  if (obj.data.type !== "waveform") return;

  const { config } = obj.data;
  const { width, height } = obj.transform;
  const halfW = width / 2;
  const halfH = height / 2;
  const { style } = obj;

  const barCount = Math.max(1, Math.min(config.barCount, 128));
  const fillColor = style.fill ?? config.color;

  const samples = audioFrame
    ? sampleFrequencyData(audioFrame.frequencyData, barCount)
    : Array.from({ length: barCount }, () => 0);

  try {
    switch (config.style) {
      case "bars":
        renderBars(ctx, samples, halfW, halfH, width, config.mirror, config.barWidth, fillColor);
        break;
      case "wave":
        renderWave(ctx, samples, halfW, halfH, fillColor);
        break;
      case "circular":
        renderCircular(ctx, samples, halfW, halfH, fillColor);
        break;
    }
  } catch {
    // Silently skip on render errors
  }
}

// ============================================================
// Bars renderer
// ============================================================

function renderBars(
  ctx: CanvasRenderingContext2D,
  samples: number[],
  halfW: number,
  halfH: number,
  totalWidth: number,
  mirror: boolean,
  configBarWidth: number,
  fillColor: string,
): void {
  const count = samples.length;
  if (count === 0) return;

  const slotWidth = totalWidth / count;
  // barWidth is a fraction of slot width (cap at 0.98)
  const barWidthFraction = Math.min(0.98, configBarWidth / slotWidth);
  const barW = slotWidth * barWidthFraction;

  ctx.fillStyle = fillColor;

  for (let i = 0; i < count; i++) {
    const value = samples[i] ?? 0;
    const cx = -halfW + slotWidth * i + slotWidth / 2;

    if (mirror) {
      // Draw from center outward both up and down
      const barH = value * halfH;
      ctx.fillRect(cx - barW / 2, -barH, barW, barH);
      ctx.fillRect(cx - barW / 2, 0, barW, barH);
    } else {
      // Draw from bottom upward
      const barH = value * halfH * 2;
      ctx.fillRect(cx - barW / 2, halfH - barH, barW, barH);
    }
  }
}

// ============================================================
// Wave renderer
// ============================================================

function renderWave(
  ctx: CanvasRenderingContext2D,
  samples: number[],
  halfW: number,
  halfH: number,
  fillColor: string,
): void {
  const count = samples.length;
  if (count < 2) return;

  ctx.beginPath();
  ctx.strokeStyle = fillColor;
  ctx.lineWidth = 2;

  for (let i = 0; i < count; i++) {
    const value = samples[i] ?? 0;
    const x = -halfW + (i / (count - 1)) * halfW * 2;
    const y = (value - 0.5) * halfH * 2;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.stroke();
}

// ============================================================
// Circular renderer
// ============================================================

function renderCircular(
  ctx: CanvasRenderingContext2D,
  samples: number[],
  halfW: number,
  halfH: number,
  fillColor: string,
): void {
  const count = samples.length;
  if (count === 0) return;

  const innerRadius = Math.min(halfW, halfH) * 0.3;
  const maxBarLen = Math.min(halfW, halfH) - innerRadius;

  ctx.fillStyle = fillColor;
  ctx.strokeStyle = fillColor;

  for (let i = 0; i < count; i++) {
    const value = samples[i] ?? 0;
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const barLen = value * maxBarLen;

    const x1 = Math.cos(angle) * innerRadius;
    const y1 = Math.sin(angle) * innerRadius;
    const x2 = Math.cos(angle) * (innerRadius + barLen);
    const y2 = Math.sin(angle) * (innerRadius + barLen);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = Math.max(1, (Math.PI * 2 * innerRadius) / count - 1);
    ctx.stroke();
  }
}
