"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/studio/ui";
import { describeDetails, studioFetch } from "@/components/studio/client-api";
import {
  OBJECT_KIND_LABELS,
  createSceneObject,
  duplicateSceneObject,
  removeSceneObject,
  reorderSceneObject,
  type NewObjectKind,
} from "@/lib/studio/scene-objects";
import { localBox, nudgeTransform } from "@/lib/studio/scene-geometry";
import { measureSceneText } from "@/lib/studio/text-measure";
import { ScenePreview, type ManualAudio, type ScenePreviewEditor } from "./scene-preview";
import { ObjectInspector } from "./object-inspector";
import { InteractionBuilder } from "./interaction-builder";
import type { Scene, SceneObject, SceneSchema, SceneTransform } from "@/types";

type Tab = "objects" | "interactions" | "scene";
const HISTORY_LIMIT = 100;
const COALESCE_MS = 700;
const GRID_SIZES = [10, 20, 40, 80] as const;

/** Canvas edit keys apply only when focus is on the canvas, a layer row, or nowhere in particular. */
function isCanvasKeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return true;
  if (target === document.body || target === document.documentElement) return true;
  return target.closest("[data-scene-canvas], [data-layer-select]") !== null;
}

interface History {
  past: SceneSchema[];
  present: SceneSchema;
  future: SceneSchema[];
  lastKey: string | null;
  lastAt: number;
}
type HistoryAction =
  | { type: "edit"; fn: (s: SceneSchema) => SceneSchema; key: string | null; at: number }
  | { type: "undo" }
  | { type: "redo" };

/** Pure history reducer; edits sharing a key within COALESCE_MS merge into one undo step. */
function historyReducer(h: History, a: HistoryAction): History {
  switch (a.type) {
    case "edit": {
      const next = a.fn(h.present);
      if (next === h.present) return h;
      const merge = a.key !== null && h.lastKey === a.key && a.at - h.lastAt < COALESCE_MS;
      return {
        past: merge ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
        lastKey: a.key,
        lastAt: a.at,
      };
    }
    case "undo": {
      const prev = h.past[h.past.length - 1];
      if (!prev) return h;
      return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future].slice(0, HISTORY_LIMIT), lastKey: null, lastAt: 0 };
    }
    case "redo": {
      const next = h.future[0];
      if (!next) return h;
      return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: h.future.slice(1), lastKey: null, lastAt: 0 };
    }
  }
}

export function SceneEditor({ scene, images, accent }: { scene: Scene; images: { id: string; filename: string }[]; accent: string }) {
  const [history, dispatch] = useReducer(historyReducer, { past: [], present: scene.schema, future: [], lastKey: null, lastAt: 0 });
  const schema = history.present;
  const [name, setName] = useState(scene.name);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify({ s: scene.schema, n: scene.name }));
  const [selectedId, setSelectedId] = useState<string | null>(scene.schema.objects[0]?.id ?? null);
  const [tab, setTab] = useState<Tab>("objects");
  const [manualAudio, setManualAudio] = useState<ManualAudio | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; details?: string[] } | null>(null);
  const [grid, setGrid] = useState<number | null>(null);
  const [gridSize, setGridSize] = useState<number>(20);
  const [guides, setGuides] = useState(true);
  const [announcement, setAnnouncement] = useState("");

  const dirty = JSON.stringify({ s: schema, n: name }) !== savedSnapshot;

  const edit = useCallback(
    (fn: (s: SceneSchema) => SceneSchema, key: string | null = null) => dispatch({ type: "edit", fn, key, at: Date.now() }),
    []
  );
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && !["checkbox", "range", "color"].includes((el as HTMLInputElement).type)))) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const sortedObjects = useMemo(() => [...schema.objects].sort((a, b) => b.transform.z - a.transform.z), [schema.objects]);
  const selected = schema.objects.find((o) => o.id === selectedId) ?? null;

  const patchSelected = useCallback(
    (fn: (o: SceneObject) => SceneObject) => {
      if (!selectedId) return;
      edit((s) => ({ ...s, objects: s.objects.map((o) => (o.id === selectedId ? { ...fn(o), updatedAt: new Date().toISOString() } : o)) }), `obj:${selectedId}`);
    },
    [edit, selectedId]
  );

  const commitTransform = useCallback(
    (id: string, transform: SceneTransform) => {
      edit((s) => ({
        ...s,
        objects: s.objects.map((o) => (o.id === id && !o.locked ? { ...o, transform, updatedAt: new Date().toISOString() } : o)),
      }));
    },
    [edit]
  );

  /** Select from the canvas or the layer list, announcing the change to screen readers. */
  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      const o = id ? schema.objects.find((x) => x.id === id) : undefined;
      setAnnouncement(o ? `Selected ${o.name}${o.locked ? ", locked" : ""}` : "Selection cleared");
    },
    [schema.objects]
  );

  const previewEditor: ScenePreviewEditor = useMemo(
    () => ({ selectedId, onSelect: select, onCommit: commitTransform, grid, guides }),
    [selectedId, select, commitTransform, grid, guides]
  );

  // Canvas keyboard commands: arrows nudge (Shift x10), Delete/Backspace removes, Escape clears the selection.
  // Text fields, selects and other controls keep their own keys (see isCanvasKeyTarget).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || !isCanvasKeyTarget(e.target)) return;
      const obj = selectedId ? schema.objects.find((o) => o.id === selectedId) : undefined;
      if (e.key === "Escape") {
        if (selectedId) {
          e.preventDefault();
          setSelectedId(null);
          setAnnouncement("Selection cleared");
        }
        return;
      }
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const dir = arrows[e.key];
      const isDelete = e.key === "Delete" || e.key === "Backspace";
      if (!obj || (!dir && !isDelete)) return;
      e.preventDefault();
      if (obj.locked) {
        setAnnouncement(`${obj.name} is locked`);
        return;
      }
      if (dir) {
        const stepSize = e.shiftKey ? 10 : 1;
        const box = localBox(obj, measureSceneText);
        const scene = { width: schema.canvasWidth, height: schema.canvasHeight };
        edit(
          (s) => ({
            ...s,
            objects: s.objects.map((o) =>
              o.id === obj.id
                ? { ...o, transform: nudgeTransform(o.transform, box, dir[0] * stepSize, dir[1] * stepSize, scene), updatedAt: new Date().toISOString() }
                : o
            ),
          }),
          `nudge:${obj.id}`
        );
      } else {
        edit((s) => removeSceneObject(s, obj.id));
        setSelectedId(null);
        setAnnouncement(`${obj.name} deleted`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [edit, schema, selectedId]);

  function addObject(kind: NewObjectKind) {
    const obj = createSceneObject(kind, schema, { accent, ...(kind === "image" && images[0] ? { assetId: images[0].id } : {}) });
    edit((s) => ({ ...s, objects: [...s.objects, obj] }));
    setSelectedId(obj.id);
    setTab("objects");
  }

  async function save() {
    setSaving(true);
    setResult(null);
    const res = await studioFetch<{ scene: Scene }>(`/api/studio/scenes/${scene.id}`, "PUT", { name, schema });
    setSaving(false);
    if (res.ok) {
      setSavedSnapshot(JSON.stringify({ s: schema, n: name }));
      setResult({ ok: true, message: "Saved. Publish the experience again to update what fans see." });
    } else {
      setResult({ ok: false, message: res.message, details: describeDetails(res.details) });
    }
  }

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === t}
      onClick={() => setTab(t)}
      className={`shrink-0 px-3 py-2 text-sm border-b-2 ${tab === t ? "border-[var(--color-accent)] text-[var(--color-fg)]" : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/studio/scenes" className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">← Scenes</Link>
        <label htmlFor="scene-name" className="sr-only">Scene name</label>
        <input
          id="scene-name"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-xl md:text-2xl font-semibold border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-fg)] focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={undo} disabled={history.past.length === 0} title="Undo (Ctrl+Z)">Undo</Button>
          <Button type="button" variant="ghost" size="sm" onClick={redo} disabled={history.future.length === 0} title="Redo (Ctrl+Shift+Z)">Redo</Button>
          <span className="text-xs font-mono text-[var(--color-fg-muted)]" aria-live="polite">{dirty ? "Unsaved" : "Saved"}</span>
          <Button type="button" size="sm" onClick={() => void save()} loading={saving} disabled={!dirty && !saving}>Save scene</Button>
        </div>
      </div>
      <FormMessage result={result} />

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4 min-w-0">
          <ScenePreview schema={schema} manualAudio={manualAudio} editor={previewEditor} />
          <div className="-mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--color-fg-muted)]">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={grid !== null} onChange={(e) => setGrid(e.target.checked ? gridSize : null)} />
              Snap to grid
            </label>
            <label htmlFor="scene-grid-size" className="flex items-center gap-1.5">
              <span className="sr-only">Grid size</span>
              <select
                id="scene-grid-size"
                value={gridSize}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setGridSize(v);
                  if (grid !== null) setGrid(v);
                }}
                className="h-7 bg-[var(--color-bg)] border border-[var(--color-border)] px-1 font-mono text-[var(--color-fg)]"
              >
                {GRID_SIZES.map((g) => (
                  <option key={g} value={g}>{g} units</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} />
              Alignment guides
            </label>
            <span className="hidden md:inline">Alt: drag without snapping · Shift: keep proportions / snap rotation</span>
            <p data-testid="selection-readout" className="w-full font-mono tabular-nums text-[var(--color-fg)]">
              {selected ? (
                <>
                  {selected.name} · X {selected.transform.x} · Y {selected.transform.y} · {selected.transform.width}×{selected.transform.height} · {selected.transform.rotation}°
                  {selected.locked && <span className="ml-2 uppercase tracking-widest text-[var(--color-fg-muted)]">Locked</span>}
                </>
              ) : (
                <span className="text-[var(--color-fg-muted)]">Nothing selected. Click an object on the canvas or a layer below.</span>
              )}
            </p>
            <p data-testid="canvas-announcer" className="sr-only" role="status" aria-live="polite">{announcement}</p>
          </div>

          <section aria-label="Objects" className="border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-[var(--color-border)]">
              <h2 className="text-xs font-mono font-semibold uppercase tracking-widest text-[var(--color-fg-muted)]">Layers ({schema.objects.length}/200)</h2>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Add object">
                {(Object.keys(OBJECT_KIND_LABELS) as NewObjectKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => addObject(k)}
                    disabled={schema.objects.length >= 200 || (k === "image" && images.length === 0)}
                    title={k === "image" && images.length === 0 ? "Upload an image in Media first" : `Add ${OBJECT_KIND_LABELS[k]}`}
                    className="h-7 px-2 text-xs border border-[var(--color-border-strong)] hover:border-[var(--color-fg)] disabled:opacity-40"
                  >
                    + {OBJECT_KIND_LABELS[k]}
                  </button>
                ))}
              </div>
            </div>
            {sortedObjects.length === 0 ? (
              <p className="px-3 py-6 text-sm text-[var(--color-fg-muted)]">Empty scene. Add a waveform or text to start.</p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {sortedObjects.map((o) => (
                  <li key={o.id} className={`flex items-center gap-2 px-3 py-1.5 ${o.id === selectedId ? "bg-white/[0.05]" : ""}`}>
                    <button type="button" data-layer-select="" onClick={() => select(o.id)} aria-pressed={o.id === selectedId} className="flex-1 min-w-0 text-left py-1">
                      <span className={`block truncate text-sm ${o.visible ? "" : "text-[var(--color-fg-subtle)] line-through"}`}>{o.name}</span>
                      <span className="block text-[10px] font-mono uppercase text-[var(--color-fg-muted)]">
                        {o.data.type}
                        {schema.interactions.some((m) => m.objectId === o.id) ? " · reactive" : ""}
                        {o.locked ? " · locked" : ""}
                      </span>
                    </button>
                    <div className="flex items-center gap-0.5 text-xs">
                      {[
                        { label: o.visible ? "Hide" : "Show", run: () => edit((s) => ({ ...s, objects: s.objects.map((x) => (x.id === o.id ? { ...x, visible: !x.visible } : x)) })) },
                        {
                          label: o.locked ? "Unlock" : "Lock",
                          pressed: o.locked,
                          run: () => edit((s) => ({ ...s, objects: s.objects.map((x) => (x.id === o.id ? { ...x, locked: !x.locked } : x)) })),
                        },
                        { label: "↑", aria: `Bring ${o.name} forward`, run: () => edit((s) => reorderSceneObject(s, o.id, "up")) },
                        { label: "↓", aria: `Send ${o.name} backward`, run: () => edit((s) => reorderSceneObject(s, o.id, "down")) },
                        { label: "Copy", aria: `Duplicate ${o.name}`, run: () => edit((s) => duplicateSceneObject(s, o.id)) },
                        {
                          label: "Delete",
                          aria: `Delete ${o.name}`,
                          disabled: o.locked,
                          run: () => {
                            edit((s) => removeSceneObject(s, o.id));
                            if (selectedId === o.id) setSelectedId(null);
                          },
                        },
                      ].map((a) => (
                        <button
                          key={a.label}
                          type="button"
                          onClick={a.run}
                          aria-label={a.aria ?? `${a.label} ${o.name}`}
                          aria-pressed={"pressed" in a ? a.pressed : undefined}
                          disabled={"disabled" in a ? a.disabled : undefined}
                          title={"disabled" in a && a.disabled ? "Unlock the layer to delete it" : undefined}
                          className="min-w-8 h-8 px-1.5 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] disabled:opacity-40 disabled:hover:text-[var(--color-fg-muted)]"
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="border border-[var(--color-border)] bg-[var(--color-bg-secondary)] min-w-0">
          <div role="tablist" aria-label="Editor panels" className="flex overflow-x-auto border-b border-[var(--color-border)] px-2">
            {tabBtn("objects", "Properties")}
            {tabBtn("interactions", `Interactions (${schema.interactions.length})`)}
            {tabBtn("scene", "Scene")}
          </div>
          <div className="p-4" role="tabpanel">
            {tab === "objects" &&
              (selected ? (
                <ObjectInspector key={selected.id} object={selected} patch={patchSelected} images={images} />
              ) : (
                <p className="text-sm text-[var(--color-fg-muted)]">Select a layer to edit its properties.</p>
              ))}
            {tab === "interactions" && (
              <InteractionBuilder
                objects={schema.objects}
                interactions={schema.interactions}
                onChange={(next) => edit((s) => ({ ...s, interactions: next }), "interactions")}
                selectedObjectId={selectedId}
                manualAudio={manualAudio}
                onManualAudio={setManualAudio}
              />
            )}
            {tab === "scene" && <SceneSettings schema={schema} edit={edit} />}
          </div>
        </aside>
      </div>
    </div>
  );
}

function SceneSettings({ schema, edit }: { schema: SceneSchema; edit: (fn: (s: SceneSchema) => SceneSchema, key?: string | null) => void }) {
  const durationSec = schema.duration === null ? "" : String(schema.duration / 1000);
  return (
    <div className="flex flex-col gap-4 text-sm">
      <label htmlFor="scene-bg" className="flex items-center gap-3">
        <input
          id="scene-bg"
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(schema.backgroundColor) ? schema.backgroundColor : "#0a0a0a"}
          onChange={(e) => edit((s) => ({ ...s, backgroundColor: e.target.value }), "bg")}
          className="h-9 w-12 cursor-pointer border border-[var(--color-border)] bg-transparent"
        />
        Background <span className="font-mono text-xs text-[var(--color-fg-muted)]">{schema.backgroundColor}</span>
      </label>
      <label htmlFor="scene-duration" className="flex flex-col gap-1">
        Duration (seconds)
        <span className="text-xs text-[var(--color-fg-muted)]">Leave empty to loop until the fan moves on. Playback stops at the end.</span>
        <input
          id="scene-duration"
          type="number"
          min={1}
          max={3600}
          step={0.5}
          value={durationSec}
          placeholder="∞"
          onChange={(e) => {
            const v = e.target.value === "" ? null : Math.round(parseFloat(e.target.value) * 1000);
            if (v === null || (Number.isFinite(v) && v > 0)) edit((s) => ({ ...s, duration: v }), "duration");
          }}
          className="h-9 bg-transparent border border-[var(--color-border)] px-2 font-mono focus:outline-none focus:border-[var(--color-fg)]"
        />
      </label>
      <p className="text-xs text-[var(--color-fg-muted)]">
        Canvas {schema.canvasWidth}×{schema.canvasHeight} · schema v{schema.version}
      </p>
      <p className="text-xs text-[var(--color-fg-muted)]">
        Timeline keyframes and cue points are not available yet. Use scene duration and the experience scene order for pacing.
      </p>
    </div>
  );
}
