"use client";

import { useEffect, useRef } from "react";
import type { SceneRuntime } from "@/lib/engine/runtime/scene-runtime";
import { Canvas2DRenderer } from "@/lib/engine/renderer/canvas2d";

// ============================================================
// Props
// ============================================================

interface SceneCanvasProps {
  runtime: SceneRuntime;
  className?: string;
  style?: React.CSSProperties;
}

// ============================================================
// SceneCanvas
// ============================================================

/**
 * Canvas component that binds a Canvas2DRenderer to a SceneRuntime.
 * Handles DPR-aware resizing and pointer input normalization.
 */
export function SceneCanvas({ runtime, className, style }: SceneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create renderer and attach to runtime
    let renderer: Canvas2DRenderer;
    try {
      renderer = new Canvas2DRenderer(canvas);
    } catch {
      // Browser may not support 2D context (e.g. headless env)
      return;
    }
    runtime.setRenderer(renderer);

    // ── Initial size: synchronously set canvas dimensions so first frame renders
    const initSize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        renderer.resize(canvas.width, canvas.height);
      }
    };
    initSize();

    // ── Resize observer ──────────────────────────────────────
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(entry.contentRect.width * dpr);
      const h = Math.round(entry.contentRect.height * dpr);
      if (w > 0 && h > 0) {
        canvas.width = w;
        canvas.height = h;
        renderer.resize(w, h);
      }
    });
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      renderer.dispose();
    };
  }, [runtime]);

  // ── Pointer event helpers ──────────────────────────────────

  function toNormalized(
    e: React.MouseEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>
  ): [number, number] {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))];
  }

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", display: "block", ...style }}
      onPointerMove={(e) => {
        const [x, y] = toNormalized(e);
        runtime.setPointerPosition(x, y);
      }}
      onPointerDown={(e) => {
        const [x, y] = toNormalized(e);
        runtime.setPointerPosition(x, y);
        runtime.setPointerDown(true);
      }}
      onPointerUp={() => {
        runtime.setPointerDown(false);
      }}
      onClick={(e) => {
        const [x, y] = toNormalized(e);
        runtime.triggerClick(x, y);
      }}
    />
  );
}
