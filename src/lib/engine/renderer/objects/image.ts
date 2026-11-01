/**
 * AII Creative Engine — Image Object Renderer
 * Renders an image SceneObject centered at (0,0) on a Canvas2D context.
 * Assumes caller has already set up the transform (translate/rotate/scale).
 */

import type { SceneObject } from "@/types/domain";
import type { RuntimeObjectState } from "@/lib/engine/types";

// ============================================================
// renderImage
// ============================================================

export function renderImage(
  ctx: CanvasRenderingContext2D,
  obj: SceneObject,
  _state: RuntimeObjectState,
  imageCache: Map<string, HTMLImageElement>,
): void {
  if (obj.data.type !== "image") return;

  const { assetId } = obj.data;
  const { width, height } = obj.transform;
  const hw = width / 2;
  const hh = height / 2;

  try {
    const cached = imageCache.get(assetId);

    if (cached !== undefined && cached.complete && cached.naturalWidth > 0) {
      // Draw image centered at (0,0)
      ctx.drawImage(cached, -hw, -hh, width, height);
    } else {
      // Placeholder: dark rect with truncated assetId label
      ctx.fillStyle = "#333333";
      ctx.fillRect(-hw, -hh, width, height);

      ctx.fillStyle = "#888888";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`IMG: ${assetId.slice(0, 8)}`, 0, 0);
    }
  } catch {
    // Silently skip on render errors
  }
}
