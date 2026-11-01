/**
 * AII Creative Engine — Shape Object Renderer
 * Renders a shape SceneObject centered at (0,0) on a Canvas2D context.
 * Assumes caller has already set up the transform (translate/rotate/scale).
 */

import type { SceneObject } from "@/types/domain";
import type { RuntimeObjectState } from "@/lib/engine/types";

// ============================================================
// Helpers
// ============================================================

function applyFillAndStroke(
  ctx: CanvasRenderingContext2D,
  fill: string | null,
  stroke: string | null,
  strokeWidth: number,
): void {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke && strokeWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

// ============================================================
// renderShape
// ============================================================

export function renderShape(
  ctx: CanvasRenderingContext2D,
  obj: SceneObject,
  _state: RuntimeObjectState,
): void {
  if (obj.data.type !== "shape") return;

  const { style, transform } = obj;
  const { variant } = obj.data;

  const hw = transform.width / 2;
  const hh = transform.height / 2;
  const fill = style.fill;
  const stroke = style.stroke;
  const strokeWidth = style.strokeWidth;
  const borderRadius = style.borderRadius;

  try {
    ctx.beginPath();

    switch (variant) {
      case "rectangle": {
        if (borderRadius > 0) {
          // Rounded rectangle using Path2D roundRect (modern browsers) or manual arcs
          const r = Math.min(borderRadius, hw, hh);
          ctx.moveTo(-hw + r, -hh);
          ctx.lineTo(hw - r, -hh);
          ctx.arcTo(hw, -hh, hw, -hh + r, r);
          ctx.lineTo(hw, hh - r);
          ctx.arcTo(hw, hh, hw - r, hh, r);
          ctx.lineTo(-hw + r, hh);
          ctx.arcTo(-hw, hh, -hw, hh - r, r);
          ctx.lineTo(-hw, -hh + r);
          ctx.arcTo(-hw, -hh, -hw + r, -hh, r);
          ctx.closePath();
        } else {
          ctx.rect(-hw, -hh, transform.width, transform.height);
        }
        break;
      }

      case "circle": {
        const radius = Math.min(hw, hh);
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        break;
      }

      case "ellipse": {
        ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
        break;
      }

      case "triangle": {
        ctx.moveTo(0, -hh);
        ctx.lineTo(hw, hh);
        ctx.lineTo(-hw, hh);
        ctx.closePath();
        break;
      }

      case "line": {
        ctx.moveTo(-hw, 0);
        ctx.lineTo(hw, 0);
        break;
      }

      case "polygon": {
        // Default to hexagon (6 sides); transform.width used as size hint
        const sides = 6;
        const radius = Math.min(hw, hh);
        for (let i = 0; i < sides; i++) {
          const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
          const px = Math.cos(angle) * radius;
          const py = Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      }

      default:
        return;
    }

    applyFillAndStroke(ctx, fill, stroke, strokeWidth);
  } catch {
    // Silently skip on render errors
  }
}
