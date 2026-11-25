"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SceneRuntime } from "@/lib/engine/runtime/scene-runtime";
import { fitScene, type SceneViewport } from "@/lib/engine/renderer/viewport";
import {
  RESIZE_HANDLES,
  guideTargets,
  hitTest,
  isCanvasPickable,
  localBox,
  moveTransform,
  resizeTransform,
  rotateTransform,
  scaledBox,
  supportsResize,
  type ResizeHandle,
} from "@/lib/studio/scene-geometry";
import { measureSceneText } from "@/lib/studio/text-measure";
import type { SceneObject, SceneSchema, SceneTransform } from "@/types";

/** Screen pixels a pointer must travel before a press becomes a drag (keeps clicks from nudging). */
const DRAG_THRESHOLD_PX = 3;
/** Alignment guide snap distance in screen pixels. */
const GUIDE_SNAP_PX = 6;
/** Extra pick tolerance in screen pixels so thin lines and empty text stay clickable. */
const PICK_TOLERANCE_PX = 4;
const ROTATE_SNAP_DEG = 15;

type DragKind = { type: "move" } | { type: "resize"; handle: ResizeHandle } | { type: "rotate" };

interface Drag {
  id: string;
  kind: DragKind;
  pointerId: number;
  start: SceneTransform;
  startScene: [number, number];
  startScreen: [number, number];
  active: boolean;
}

interface Live {
  id: string;
  transform: SceneTransform;
  guideX: number | null;
  guideY: number | null;
}

export interface CanvasEditLayerProps {
  schema: SceneSchema;
  runtime: SceneRuntime;
  /** False while the preview plays: pointer input then goes to the scene's own interactions. */
  active: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCommit: (id: string, transform: SceneTransform) => void;
  /** Grid step in scene units, or null. */
  grid: number | null;
  guides: boolean;
}

/** Pointer-initiated focus: keyboard commands work next, without the keyboard focus ring. */
function focusWithoutRing(el: HTMLElement | null) {
  // focusVisible is not in every TS DOM lib yet; browsers without it ignore the option.
  el?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
}

function withTransform(schema: SceneSchema, id: string, transform: SceneTransform): SceneSchema {
  return { ...schema, objects: schema.objects.map((o) => (o.id === id ? { ...o, transform } : o)) };
}

function sameTransform(a: SceneTransform, b: SceneTransform): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height && a.rotation === b.rotation;
}

const HANDLE_CURSOR: Record<ResizeHandle, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

/**
 * Direct-manipulation layer drawn over the Studio preview canvas.
 *
 * During a drag only this component re-renders (once per animation frame) and the
 * canvas is redrawn straight through the runtime; the editor's schema/history is
 * updated once, on pointer up.
 */
export const CanvasEditLayer = memo(function CanvasEditLayer({
  schema,
  runtime,
  active,
  selectedId,
  onSelect,
  onCommit,
  grid,
  guides,
}: CanvasEditLayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [live, setLive] = useState<Live | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const pendingRef = useRef<{ x: number; y: number; shift: boolean; alt: boolean } | null>(null);
  const rafRef = useRef(0);
  const liveRef = useRef<Live | null>(null);
  const schemaRef = useRef(schema);
  useLayoutEffect(() => {
    schemaRef.current = schema;
  }, [schema]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const vp: SceneViewport | null = useMemo(
    () => (size.w > 0 && size.h > 0 ? fitScene(size.w, size.h, schema.canvasWidth, schema.canvasHeight) : null),
    [size.w, size.h, schema.canvasWidth, schema.canvasHeight]
  );
  const vpRef = useRef(vp);
  useLayoutEffect(() => {
    vpRef.current = vp;
  }, [vp]);

  const toScene = useCallback((clientX: number, clientY: number): [number, number] | null => {
    const el = rootRef.current;
    const v = vpRef.current;
    if (!el || !v) return null;
    const r = el.getBoundingClientRect();
    return [(clientX - r.left - v.offsetX) / v.scale, (clientY - r.top - v.offsetY) / v.scale];
  }, []);

  /** Redraw the canvas with a transform that is not committed yet. */
  const previewOnCanvas = useCallback(
    (s: SceneSchema) => {
      runtime.setSchema(s);
      runtime.reset();
    },
    [runtime]
  );

  const endDrag = useCallback(
    (commit: boolean) => {
      const drag = dragRef.current;
      cancelAnimationFrame(rafRef.current);
      pendingRef.current = null;
      dragRef.current = null;
      const result = liveRef.current;
      liveRef.current = null;
      setLive(null);
      if (!drag) return;
      const el = rootRef.current;
      if (el?.hasPointerCapture(drag.pointerId)) el.releasePointerCapture(drag.pointerId);
      if (commit && drag.active && result && !sameTransform(result.transform, drag.start)) {
        onCommit(drag.id, result.transform);
      } else if (drag.active) {
        // Cancelled (Esc / pointercancel) or no net change: put the committed schema back on the canvas.
        previewOnCanvas(schemaRef.current);
      }
    },
    [onCommit, previewOnCanvas]
  );

  // Esc cancels a drag in progress before the editor treats it as "deselect".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dragRef.current) {
        e.preventDefault();
        e.stopImmediatePropagation();
        endDrag(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [endDrag]);

  // Leaving edit mode (Play) or unmounting abandons any drag.
  useEffect(() => {
    if (!active && dragRef.current) endDrag(false);
  }, [active, endDrag]);
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const step = useCallback(() => {
    rafRef.current = 0;
    const drag = dragRef.current;
    const p = pendingRef.current;
    const v = vpRef.current;
    if (!drag || !p || !v) return;
    const s = schemaRef.current;
    const obj = s.objects.find((o) => o.id === drag.id);
    if (!obj) return;
    const pt = toScene(p.x, p.y);
    if (!pt) return;
    if (!drag.active) {
      if (Math.hypot(p.x - drag.startScreen[0], p.y - drag.startScreen[1]) < DRAG_THRESHOLD_PX) return;
      drag.active = true;
    }
    const dx = pt[0] - drag.startScene[0];
    const dy = pt[1] - drag.startScene[1];
    let next: Live;
    if (drag.kind.type === "move") {
      const snapping = !p.alt;
      const box = localBox({ ...obj, transform: drag.start }, measureSceneText);
      const r = moveTransform(drag.start, box, dx, dy, { width: s.canvasWidth, height: s.canvasHeight }, {
        grid: snapping ? grid : null,
        guides:
          snapping && guides
            ? { ...guideTargets(s.objects, obj.id, { width: s.canvasWidth, height: s.canvasHeight }, measureSceneText), threshold: GUIDE_SNAP_PX / v.scale }
            : null,
      });
      next = { id: obj.id, transform: r.transform, guideX: r.guideX, guideY: r.guideY };
    } else if (drag.kind.type === "resize") {
      next = { id: obj.id, transform: resizeTransform(drag.start, drag.kind.handle, dx, dy, { keepAspect: p.shift }), guideX: null, guideY: null };
    } else {
      next = { id: obj.id, transform: rotateTransform(drag.start, drag.startScene, pt, p.shift ? ROTATE_SNAP_DEG : null), guideX: null, guideY: null };
    }
    liveRef.current = next;
    setLive(next);
    previewOnCanvas(withTransform(s, obj.id, next.transform));
  }, [grid, guides, previewOnCanvas, toScene]);

  const beginDrag = (e: React.PointerEvent, id: string, kind: DragKind) => {
    const obj = schemaRef.current.objects.find((o) => o.id === id);
    const pt = toScene(e.clientX, e.clientY);
    if (!obj || obj.locked || !pt) return;
    rootRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = {
      id,
      kind,
      pointerId: e.pointerId,
      start: obj.transform,
      startScene: pt,
      startScreen: [e.clientX, e.clientY],
      // Handles act immediately; moving waits for the threshold so a click only selects.
      active: kind.type !== "move",
    };
  };

  const pickAt = (clientX: number, clientY: number): string | null => {
    const pt = toScene(clientX, clientY);
    const v = vpRef.current;
    if (!pt || !v) return null;
    return hitTest(schemaRef.current.objects, pt[0], pt[1], { tolerance: PICK_TOLERANCE_PX / v.scale, measureText: measureSceneText });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active || e.button > 0 || dragRef.current) return;
    focusWithoutRing(rootRef.current);
    // A paused frame shows interaction-driven transforms; snap back to the authored frame before editing.
    if (runtime.getSnapshot().status !== "idle") previewOnCanvas(schemaRef.current);
    const id = pickAt(e.clientX, e.clientY);
    onSelect(id);
    if (id) {
      e.preventDefault();
      beginDrag(e, id, { type: "move" });
    }
  };

  const onHandleDown = (e: React.PointerEvent, id: string, kind: DragKind) => {
    if (!active || e.button > 0 || dragRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    focusWithoutRing(rootRef.current);
    if (runtime.getSnapshot().status !== "idle") previewOnCanvas(schemaRef.current);
    beginDrag(e, id, kind);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      // Hover feedback without React state: just the cursor.
      if (active && e.pointerType === "mouse" && rootRef.current) {
        rootRef.current.style.cursor = pickAt(e.clientX, e.clientY) ? "move" : "default";
      }
      return;
    }
    if (e.pointerId !== drag.pointerId) return;
    pendingRef.current = { x: e.clientX, y: e.clientY, shift: e.shiftKey, alt: e.altKey };
    if (!rafRef.current) rafRef.current = requestAnimationFrame(step);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    // Apply the last pointer position before committing.
    pendingRef.current = { x: e.clientX, y: e.clientY, shift: e.shiftKey, alt: e.altKey };
    step();
    endDrag(true);
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current && e.pointerId === dragRef.current.pointerId) endDrag(false);
  };

  const selected: SceneObject | null = schema.objects.find((o) => o.id === selectedId) ?? null;
  const shown = selected && live && live.id === selected.id ? { ...selected, transform: live.transform } : selected;

  return (
    <div
      ref={rootRef}
      data-scene-canvas=""
      tabIndex={active ? 0 : -1}
      aria-label="Scene canvas. Click an object to select it and drag to move it. Arrow keys move the selection, Shift for larger steps. Escape clears the selection."
      aria-disabled={!active}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={(e) => {
        if (dragRef.current && e.pointerId === dragRef.current.pointerId) endDrag(true);
      }}
      className="absolute inset-0 select-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-fg)]"
      style={{ pointerEvents: active ? "auto" : "none", touchAction: active ? "none" : "auto" }}
    >
      {active && vp && grid && grid * vp.scale >= 6 && (
        <div
          aria-hidden="true"
          data-testid="scene-grid"
          className="pointer-events-none absolute opacity-40"
          style={{
            left: vp.offsetX,
            top: vp.offsetY,
            width: schema.canvasWidth * vp.scale,
            height: schema.canvasHeight * vp.scale,
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.18) 1px, transparent 1px)",
            backgroundSize: `${grid * vp.scale}px ${grid * vp.scale}px`,
          }}
        />
      )}

      {active && vp && live && live.guideX !== null && (
        <div
          aria-hidden="true"
          data-testid="scene-guide-x"
          className="pointer-events-none absolute w-px bg-[var(--color-secondary-accent)]"
          style={{ left: vp.offsetX + live.guideX * vp.scale, top: vp.offsetY, height: schema.canvasHeight * vp.scale }}
        />
      )}
      {active && vp && live && live.guideY !== null && (
        <div
          aria-hidden="true"
          data-testid="scene-guide-y"
          className="pointer-events-none absolute h-px bg-[var(--color-secondary-accent)]"
          style={{ top: vp.offsetY + live.guideY * vp.scale, left: vp.offsetX, width: schema.canvasWidth * vp.scale }}
        />
      )}

      {active && vp && shown && (
        <SelectionBox
          obj={shown}
          vp={vp}
          dragging={live !== null}
          onHandleDown={(e, kind) => onHandleDown(e, shown.id, kind)}
        />
      )}
    </div>
  );
});

function SelectionBox({
  obj,
  vp,
  dragging,
  onHandleDown,
}: {
  obj: SceneObject;
  vp: SceneViewport;
  dragging: boolean;
  onHandleDown: (e: React.PointerEvent, kind: DragKind) => void;
}) {
  const t = obj.transform;
  const b = scaledBox(t, localBox(obj, measureSceneText));
  const left = b.left * vp.scale;
  const top = b.top * vp.scale;
  const width = Math.max(1, (b.right - b.left) * vp.scale);
  const height = Math.max(1, (b.bottom - b.top) * vp.scale);
  // Locked objects get an outline only; hidden ones are not on the canvas to grab.
  const editable = isCanvasPickable(obj);
  const canResize = editable && supportsResize(obj);
  const outline = obj.locked ? "border-dashed border-[var(--color-fg-muted)]" : "border-[var(--color-accent)]";

  return (
    <div
      data-testid="scene-selection"
      data-object-id={obj.id}
      data-locked={obj.locked ? "" : undefined}
      aria-hidden="true"
      className="pointer-events-none absolute"
      style={{ left: vp.offsetX + t.x * vp.scale, top: vp.offsetY + t.y * vp.scale, width: 0, height: 0, transform: `rotate(${t.rotation}deg)` }}
    >
      <div className={`absolute border ${outline}`} style={{ left, top, width, height }}>
        {obj.locked && (
          <span className="absolute -top-5 left-0 whitespace-nowrap bg-[var(--color-bg)] px-1 text-[10px] font-mono uppercase tracking-widest text-[var(--color-fg-muted)]">
            Locked
          </span>
        )}
        {dragging && (
          <span
            data-testid="scene-transform-readout"
            className="absolute left-0 top-full mt-1 whitespace-nowrap bg-[var(--color-bg)] px-1 text-[10px] font-mono tabular-nums text-[var(--color-fg)]"
          >
            {`X ${Math.round(t.x)}  Y ${Math.round(t.y)}  ${Math.round(t.width)}×${Math.round(t.height)}  ${t.rotation}°`}
          </span>
        )}
        {canResize &&
          (Object.keys(RESIZE_HANDLES) as ResizeHandle[]).map((h) => {
            const [hx, hy] = RESIZE_HANDLES[h];
            return (
              <span
                key={h}
                data-handle={h}
                onPointerDown={(e) => onHandleDown(e, { type: "resize", handle: h })}
                className="pointer-events-auto absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                style={{ left: `${((hx + 1) / 2) * 100}%`, top: `${((hy + 1) / 2) * 100}%`, cursor: HANDLE_CURSOR[h], touchAction: "none" }}
              >
                <span className="h-2.5 w-2.5 border border-[var(--color-accent)] bg-[var(--color-bg)]" />
              </span>
            );
          })}
        {editable && (
          <>
            <span className="absolute left-1/2 -top-6 h-6 w-px bg-[var(--color-accent)]" />
            <span
              data-handle="rotate"
              onPointerDown={(e) => onHandleDown(e, { type: "rotate" })}
              className="pointer-events-auto absolute left-1/2 -top-6 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
              style={{ cursor: "grab", touchAction: "none" }}
            >
              <span className="h-3 w-3 rounded-full border border-[var(--color-accent)] bg-[var(--color-bg)]" />
            </span>
          </>
        )}
      </div>
    </div>
  );
}
