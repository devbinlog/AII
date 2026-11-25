// Pure geometry for direct manipulation on the Studio scene canvas.
//
// Mirrors how the Canvas2D renderer draws an object (renderer/canvas2d.ts):
//   translate(x, y) → rotate(rotation°) → scale(scaleX, scaleY) → draw around (0, 0)
// Shapes, images, waveforms and particles draw a width×height box centred on (x, y).
// Text draws at (x, y) with textAlign and a "middle" baseline; its width/height
// fields are not used by the renderer, so its box comes from the measured text.
// Nothing here adds fields to the Scene DSL — every result is a SceneTransform.

import type { SceneObject, SceneTransform } from "@/types";

/** Box relative to the object anchor (x, y), in unscaled, unrotated scene units. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SceneSize {
  width: number;
  height: number;
}

/** Returns the rendered advance width of a text object, in scene units. */
export type TextMeasure = (obj: SceneObject) => number;

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const RESIZE_HANDLES: Record<ResizeHandle, readonly [number, number]> = {
  nw: [-1, -1],
  n: [0, -1],
  ne: [1, -1],
  e: [1, 0],
  se: [1, 1],
  s: [0, 1],
  sw: [-1, 1],
  w: [-1, 0],
};

/** Object types the Canvas2D renderer draws (group and object3d are skipped there). */
const CANVAS_RENDERED = new Set<SceneObject["data"]["type"]>(["text", "image", "shape", "particle", "waveform"]);

export function isCanvasRendered(obj: SceneObject): boolean {
  return CANVAS_RENDERED.has(obj.data.type);
}

/** Objects that can be clicked on the canvas: drawn, visible and not locked. */
export function isCanvasPickable(obj: SceneObject): boolean {
  return isCanvasRendered(obj) && obj.visible && !obj.locked;
}

/** Whether width/height handles change what is drawn (text ignores width/height). */
export function supportsResize(obj: SceneObject): boolean {
  return isCanvasRendered(obj) && obj.data.type !== "text";
}

export function localBox(obj: SceneObject, measureText?: TextMeasure): Box {
  if (obj.data.type === "text") {
    const fontSize = obj.style.fontSize ?? 16; // renderer default
    const width = Math.max(0, measureText ? measureText(obj) : obj.transform.width);
    const align = obj.style.textAlign ?? "center"; // renderer default
    const left = align === "left" ? 0 : align === "right" ? -width : -width / 2;
    const half = fontSize * 0.6;
    return { left, top: -half, right: left + width, bottom: half };
  }
  const hw = obj.transform.width / 2;
  const hh = obj.transform.height / 2;
  return { left: -hw, top: -hh, right: hw, bottom: hh };
}

/** Box after scaleX/scaleY (still unrotated, relative to the anchor). */
export function scaledBox(t: SceneTransform, box: Box): Box {
  const x0 = box.left * t.scaleX;
  const x1 = box.right * t.scaleX;
  const y0 = box.top * t.scaleY;
  const y1 = box.bottom * t.scaleY;
  return { left: Math.min(x0, x1), top: Math.min(y0, y1), right: Math.max(x0, x1), bottom: Math.max(y0, y1) };
}

function rotate(x: number, y: number, degrees: number): [number, number] {
  const r = (degrees * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [x * c - y * s, x * s + y * c];
}

/** Scene point → the object's scaled local frame (rotation undone, scale kept). */
export function toLocal(t: SceneTransform, px: number, py: number): [number, number] {
  return rotate(px - t.x, py - t.y, -t.rotation);
}

export function worldCorners(t: SceneTransform, box: Box): [number, number][] {
  const b = scaledBox(t, box);
  return [
    [b.left, b.top],
    [b.right, b.top],
    [b.right, b.bottom],
    [b.left, b.bottom],
  ].map(([x, y]) => {
    const [rx, ry] = rotate(x!, y!, t.rotation);
    return [t.x + rx, t.y + ry] as [number, number];
  });
}

/** Axis-aligned bounds in scene coordinates. */
export function worldAabb(t: SceneTransform, box: Box): Box {
  const pts = worldCorners(t, box);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

export function containsPoint(t: SceneTransform, box: Box, px: number, py: number, tolerance = 0): boolean {
  const b = scaledBox(t, box);
  const [lx, ly] = toLocal(t, px, py);
  return lx >= b.left - tolerance && lx <= b.right + tolerance && ly >= b.top - tolerance && ly <= b.bottom + tolerance;
}

/**
 * Topmost pickable object under a scene point, or null.
 * Paint order matches the renderer: ascending z, ties in array order (stable sort),
 * so the topmost is the highest z and, among equal z, the later array entry.
 */
export function hitTest(
  objects: readonly SceneObject[],
  px: number,
  py: number,
  options: { tolerance?: number; measureText?: TextMeasure } = {}
): string | null {
  const order = objects
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => isCanvasPickable(o))
    .sort((a, b) => b.o.transform.z - a.o.transform.z || b.i - a.i);
  for (const { o } of order) {
    if (containsPoint(o.transform, localBox(o, options.measureText), px, py, options.tolerance ?? 0)) return o.id;
  }
  return null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Allowed anchor range on one axis so the object's bounds [v+minOff, v+maxOff]
 * stay inside [0, size]. An object larger than the scene keeps its anchor inside.
 * The range always includes `start`, so an object already outside never jumps.
 */
function anchorRange(start: number, minOff: number, maxOff: number, size: number): [number, number] {
  let lo = -minOff;
  let hi = size - maxOff;
  if (lo > hi) {
    lo = 0;
    hi = size;
  }
  return [Math.min(lo, start), Math.max(hi, start)];
}

export interface GuideTargets {
  xs: number[];
  ys: number[];
}

export interface MoveOptions {
  /** Grid step in scene units, or null for no grid snapping. */
  grid?: number | null;
  /** Alignment targets and snap distance (scene units). Guides win over the grid. */
  guides?: (GuideTargets & { threshold: number }) | null;
}

export interface MoveResult {
  transform: SceneTransform;
  /** Guide lines the object snapped to (scene coordinates). */
  guideX: number | null;
  guideY: number | null;
}

function snapAxis(
  value: number,
  minOff: number,
  maxOff: number,
  targets: number[] | undefined,
  threshold: number,
  grid: number | null | undefined
): { value: number; guide: number | null } {
  if (targets && targets.length > 0) {
    const edges = [minOff, (minOff + maxOff) / 2, maxOff];
    let best: { diff: number; target: number } | null = null;
    for (const off of edges) {
      for (const target of targets) {
        const diff = target - (value + off);
        if (Math.abs(diff) <= threshold && (!best || Math.abs(diff) < Math.abs(best.diff))) best = { diff, target };
      }
    }
    if (best) return { value: round2(value + best.diff), guide: best.target };
  }
  if (grid && grid > 0) return { value: Math.round(value / grid) * grid, guide: null };
  return { value: Math.round(value), guide: null };
}

/** Moves an object by a scene-space delta with optional snapping, kept inside the scene. */
export function moveTransform(start: SceneTransform, box: Box, dx: number, dy: number, scene: SceneSize, options: MoveOptions = {}): MoveResult {
  const a = worldAabb(start, box);
  const off = { minX: a.left - start.x, maxX: a.right - start.x, minY: a.top - start.y, maxY: a.bottom - start.y };
  const g = options.guides;
  const sx = snapAxis(start.x + dx, off.minX, off.maxX, g?.xs, g?.threshold ?? 0, options.grid);
  const sy = snapAxis(start.y + dy, off.minY, off.maxY, g?.ys, g?.threshold ?? 0, options.grid);
  const [xLo, xHi] = anchorRange(start.x, off.minX, off.maxX, scene.width);
  const [yLo, yHi] = anchorRange(start.y, off.minY, off.maxY, scene.height);
  const x = clamp(sx.value, xLo, xHi);
  const y = clamp(sy.value, yLo, yHi);
  return {
    transform: { ...start, x, y },
    guideX: x === sx.value ? sx.guide : null,
    guideY: y === sy.value ? sy.guide : null,
  };
}

/** Keyboard nudge: exact delta (no rounding to the grid), still kept inside the scene. */
export function nudgeTransform(t: SceneTransform, box: Box, dx: number, dy: number, scene: SceneSize): SceneTransform {
  const a = worldAabb(t, box);
  const [xLo, xHi] = anchorRange(t.x, a.left - t.x, a.right - t.x, scene.width);
  const [yLo, yHi] = anchorRange(t.y, a.top - t.y, a.bottom - t.y, scene.height);
  return { ...t, x: clamp(round2(t.x + dx), xLo, xHi), y: clamp(round2(t.y + dy), yLo, yHi) };
}

/**
 * Resizes a centred box from a handle; the opposite edge/corner stays put.
 * Works in the object's visual (rotated, scaled) frame and writes unscaled width/height.
 * keepAspect applies to corner handles.
 */
export function resizeTransform(
  start: SceneTransform,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  options: { keepAspect?: boolean; minSize?: number } = {}
): SceneTransform {
  const sx = Math.abs(start.scaleX);
  const sy = Math.abs(start.scaleY);
  if (sx === 0 || sy === 0) return start;
  const minSize = options.minSize ?? 1;
  const [hx, hy] = RESIZE_HANDLES[handle];
  const [ldx, ldy] = rotate(dx, dy, -start.rotation);
  let w = hx !== 0 ? Math.max(minSize, start.width + (hx * ldx) / sx) : start.width;
  let h = hy !== 0 ? Math.max(minSize, start.height + (hy * ldy) / sy) : start.height;
  if (options.keepAspect && hx !== 0 && hy !== 0 && start.width > 0 && start.height > 0) {
    const fw = w / start.width;
    const fh = h / start.height;
    const f = Math.abs(fw - 1) >= Math.abs(fh - 1) ? fw : fh;
    w = Math.max(minSize, start.width * f);
    h = Math.max(minSize, start.height * f);
  }
  w = Math.round(w);
  h = Math.round(h);
  const [wx, wy] = rotate((hx * (w - start.width) * sx) / 2, (hy * (h - start.height) * sy) / 2, start.rotation);
  return { ...start, width: w, height: h, x: round2(start.x + wx), y: round2(start.y + wy) };
}

/** Normalises degrees to (-180, 180]. */
export function normalizeDegrees(deg: number): number {
  const r = ((((deg + 180) % 360) + 360) % 360) - 180;
  return r === -180 ? 180 : r;
}

/** Rotation from dragging a handle around the anchor; snapStep in degrees (e.g. 15) or null. */
export function rotateTransform(
  start: SceneTransform,
  from: readonly [number, number],
  to: readonly [number, number],
  snapStep: number | null = null
): SceneTransform {
  const a0 = Math.atan2(from[1] - start.y, from[0] - start.x);
  const a1 = Math.atan2(to[1] - start.y, to[0] - start.x);
  let deg = start.rotation + ((a1 - a0) * 180) / Math.PI;
  if (snapStep && snapStep > 0) deg = Math.round(deg / snapStep) * snapStep;
  return { ...start, rotation: Math.round(normalizeDegrees(deg) * 10) / 10 };
}

/** Alignment targets: scene edges and centre, plus every other drawn, visible object's edges and centre. */
export function guideTargets(objects: readonly SceneObject[], excludeId: string, scene: SceneSize, measureText?: TextMeasure): GuideTargets {
  const xs = [0, scene.width / 2, scene.width];
  const ys = [0, scene.height / 2, scene.height];
  for (const o of objects) {
    if (o.id === excludeId || !isCanvasRendered(o) || !o.visible) continue;
    const b = worldAabb(o.transform, localBox(o, measureText));
    xs.push(b.left, (b.left + b.right) / 2, b.right);
    ys.push(b.top, (b.top + b.bottom) / 2, b.bottom);
  }
  return { xs, ys };
}
