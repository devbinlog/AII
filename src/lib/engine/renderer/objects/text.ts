/**
 * AII Creative Engine — Text Object Renderer
 * Renders a text SceneObject on a Canvas2D context.
 * Assumes caller has already set up the transform (translate/rotate/scale).
 */

import type { SceneObject } from "@/types/domain";
import type { RuntimeObjectState } from "@/lib/engine/types";

// ============================================================
// Color utilities
// ============================================================

/** Parse "#RRGGBB" or "#RGB" → [r, g, b] (0-255). Returns null on failure. */
function hexToRgb(hex: string): [number, number, number] | null {
  const cleaned = hex.replace("#", "");
  let r: number, g: number, b: number;
  if (cleaned.length === 3) {
    r = parseInt(cleaned[0]! + cleaned[0]!, 16);
    g = parseInt(cleaned[1]! + cleaned[1]!, 16);
    b = parseInt(cleaned[2]! + cleaned[2]!, 16);
  } else if (cleaned.length === 6) {
    r = parseInt(cleaned.slice(0, 2), 16);
    g = parseInt(cleaned.slice(2, 4), 16);
    b = parseInt(cleaned.slice(4, 6), 16);
  } else {
    return null;
  }
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return [r, g, b];
}

/** Convert RGB (0-255) → HSL (h: 0-360, s: 0-100, l: 0-100) */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) {
    h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  } else if (max === gn) {
    h = ((bn - rn) / d + 2) / 6;
  } else {
    h = ((rn - gn) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hueToRgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

/** Convert HSL (h: 0-360, s: 0-100, l: 0-100) → "rgb(r,g,b)" */
function hslToRgbString(h: number, s: number, l: number): string {
  const hn = h / 360;
  const sn = s / 100;
  const ln = l / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return `rgb(${v},${v},${v})`;
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const r = Math.round(hueToRgb(p, q, hn + 1 / 3) * 255);
  const g = Math.round(hueToRgb(p, q, hn) * 255);
  const b = Math.round(hueToRgb(p, q, hn - 1 / 3) * 255);
  return `rgb(${r},${g},${b})`;
}

/**
 * Apply colorHue offset and colorBrightness multiplier to a hex color.
 * colorHue: degrees to add to hue (0-360 additive)
 * colorBrightness: multiplier on lightness (0-2), 1 = no change
 */
function applyColorAdjustments(
  hex: string,
  colorHue: number | undefined,
  colorBrightness: number | undefined,
): string {
  if (colorHue === undefined && colorBrightness === undefined) return hex;
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  let [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  if (colorHue !== undefined) h = (h + colorHue) % 360;
  if (colorBrightness !== undefined) l = Math.min(100, l * colorBrightness);
  return hslToRgbString(h, s, l);
}

// ============================================================
// renderText
// ============================================================

export function renderText(
  ctx: CanvasRenderingContext2D,
  obj: SceneObject,
  state: RuntimeObjectState,
): void {
  if (obj.data.type !== "text") return;

  const { style } = obj;
  const { content } = obj.data;
  if (!content) return;

  const fontSize = style.fontSize ?? 16;
  const fontFamily = style.fontFamily ?? "sans-serif";
  const fontWeight = style.fontWeight ?? 400;
  const textAlign = style.textAlign ?? "center";

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = textAlign as CanvasTextAlign;
  ctx.textBaseline = "middle";

  const fillColor = style.fill ?? "#ffffff";
  const adjustedColor = applyColorAdjustments(
    fillColor,
    state.colorHue,
    state.colorBrightness,
  );

  ctx.fillStyle = adjustedColor;

  try {
    ctx.fillText(content, 0, 0);
  } catch {
    // Silently skip on render errors
  }
}
