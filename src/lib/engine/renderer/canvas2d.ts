/**
 * AII Creative Engine — Canvas2D Renderer
 * Main renderer implementing RendererInterface.
 * Orchestrates sub-renderers for each SceneObject type.
 */

import type { SceneObject } from "@/types/domain";
import type { RendererInterface, RenderParams, RuntimeObjectState } from "@/lib/engine/types";
import { renderText } from "./objects/text";
import { renderShape } from "./objects/shape";
import { renderImage } from "./objects/image";
import { ParticleSystem } from "./objects/particle";
import { renderWaveform } from "./objects/waveform";

// ============================================================
// Helpers
// ============================================================

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ============================================================
// Canvas2DRenderer
// ============================================================

export class Canvas2DRenderer implements RendererInterface {
  private readonly _canvas: HTMLCanvasElement;
  private readonly _ctx: CanvasRenderingContext2D;
  private _particleSystems: Map<string, ParticleSystem> = new Map();
  private _imageCache: Map<string, HTMLImageElement> = new Map();
  private _lastElapsedMs: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas2DRenderer: Failed to acquire 2D rendering context");
    }
    this._canvas = canvas;
    this._ctx = ctx;
  }

  render(params: RenderParams): void {
    const { schema, state, audioFrame, elapsedMs, seed } = params;
    const ctx = this._ctx;
    const canvas = this._canvas;

    // Calculate delta time, cap at 100ms to prevent hitching after tab switch
    const dt = Math.min(elapsedMs - this._lastElapsedMs, 100);
    this._lastElapsedMs = elapsedMs;

    // 1. Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Fill background
    ctx.fillStyle = schema.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Calculate scale to fit scene maintaining aspect ratio (letterbox/pillarbox)
    const scaleX = canvas.width / schema.canvasWidth;
    const scaleY = canvas.height / schema.canvasHeight;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (canvas.width - schema.canvasWidth * scale) / 2;
    const offsetY = (canvas.height - schema.canvasHeight * scale) / 2;

    // 4. Apply scene transform
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // 5. Sort objects by z-depth (ascending: lower z = rendered first = behind)
    const sorted = [...schema.objects].sort(
      (a, b) => a.transform.z - b.transform.z,
    );

    // 6. Render each visible object
    for (const obj of sorted) {
      const objState: RuntimeObjectState | undefined = state[obj.id];
      const isVisible = objState !== undefined ? objState.visible : obj.visible;

      if (!isVisible) continue;

      const t = objState !== undefined ? objState.transform : obj.transform;
      const currentState: RuntimeObjectState = objState ?? {
        transform: obj.transform,
        visible: obj.visible,
      };

      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate((t.rotation * Math.PI) / 180);
      ctx.scale(t.scaleX, t.scaleY);
      ctx.globalAlpha = clamp(t.opacity, 0, 1);
      ctx.globalCompositeOperation = (
        obj.style.blendMode || "source-over"
      ) as GlobalCompositeOperation;

      try {
        this._renderObject(ctx, obj, currentState, audioFrame, dt, seed);
      } catch {
        // Silently skip on per-object render errors
      }

      ctx.restore();
    }

    // 7. Restore scene transform
    ctx.restore();
  }

  private _renderObject(
    ctx: CanvasRenderingContext2D,
    obj: SceneObject,
    state: RuntimeObjectState,
    audioFrame: RenderParams["audioFrame"],
    dt: number,
    seed: number,
  ): void {
    switch (obj.data.type) {
      case "text":
        renderText(ctx, obj, state);
        break;

      case "shape":
        renderShape(ctx, obj, state);
        break;

      case "image":
        renderImage(ctx, obj, state, this._imageCache);
        break;

      case "particle": {
        const { config } = obj.data;
        let ps = this._particleSystems.get(obj.id);
        if (!ps) {
          ps = new ParticleSystem(config, seed ^ obj.id.charCodeAt(0));
          this._particleSystems.set(obj.id, ps);
        }
        const targetCount = state.particleCount ?? config.count;
        const speedMult = state.particleSpeed ?? 1;
        ps.update(dt, targetCount, speedMult);
        ps.render(ctx, config.color, state.colorHue, state.colorBrightness);
        break;
      }

      case "waveform":
        renderWaveform(ctx, obj, audioFrame);
        break;

      case "group":
        // Groups are handled via childIds; individual children are already in schema.objects
        break;

      case "object3d":
        // 3D objects are not rendered by Canvas2D — skip silently
        break;
    }
  }

  resize(width: number, height: number): void {
    this._canvas.width = width;
    this._canvas.height = height;
  }

  dispose(): void {
    this._particleSystems.clear();
    this._imageCache.clear();
  }
}
