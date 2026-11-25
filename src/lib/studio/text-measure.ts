// Browser-only text measurement matching the Canvas2D text renderer's font string.

import type { SceneObject } from "@/types";

let ctx: CanvasRenderingContext2D | null | undefined;

/** Rendered advance width of a text object in scene units; falls back to transform.width without a 2D context. */
export function measureSceneText(obj: SceneObject): number {
  if (obj.data.type !== "text") return obj.transform.width;
  if (ctx === undefined) {
    try {
      ctx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
    } catch {
      ctx = null;
    }
  }
  if (!ctx) return obj.transform.width;
  const s = obj.style;
  ctx.font = `${s.fontWeight ?? 400} ${s.fontSize ?? 16}px ${s.fontFamily ?? "sans-serif"}`;
  return ctx.measureText(obj.data.content).width;
}
