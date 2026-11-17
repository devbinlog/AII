"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  GRID_STEP,
  defaultStageLayout,
  historyReducer,
  initHistory,
  isMovable,
  moveItem,
  nudgeItem,
  rotateItem,
  type CameraView,
  type StageLayout,
  type Vec3,
} from "@/lib/stage";
import { studioFetch, describeDetails } from "@/components/studio/client-api";
import { FormMessage } from "@/components/studio/ui";

// three.js only runs in the browser; keep it out of the server bundle and initial page JS.
const StageCanvas = dynamic(() => import("./stage-canvas").then((m) => m.StageCanvas), {
  ssr: false,
  loading: () => <div className="absolute inset-0 grid place-items-center text-sm text-[var(--color-fg-muted)]">Loading 3D stage…</div>,
});

const VIEWS: { name: CameraView; label: string }[] = [
  { name: "perspective", label: "Perspective" },
  { name: "top", label: "Top" },
  { name: "front", label: "Front" },
  { name: "side", label: "Side" },
];

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export interface StagePublishInfo {
  artistSlug: string;
  canPublish: boolean;
  publishedVersion: { id: string; version: number; publishedAt: string } | null;
  versionCount: number;
}

export function StageConfigurator({
  initialLayout,
  savedAt,
  canEdit,
  publish,
}: {
  initialLayout: StageLayout;
  savedAt: string | null;
  canEdit: boolean;
  publish: StagePublishInfo;
}) {
  const [history, dispatch] = useReducer(historyReducer<StageLayout>, initialLayout, initHistory);
  const layout = history.present;
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initialLayout.items));
  const [lastSaved, setLastSaved] = useState(savedAt);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<{ name: CameraView; nonce: number }>({ name: "perspective", nonce: 0 });
  const [camera, setCamera] = useState<{ position: Vec3; target: Vec3 } | null>(null);
  const [busy, setBusy] = useState<"save" | "restore" | "publish" | "unpublish" | null>(null);
  const [published, setPublished] = useState(publish.publishedVersion);
  const [versionCount, setVersionCount] = useState(publish.versionCount);
  const [result, setResult] = useState<{ ok: boolean; message: string; details?: string[] } | null>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const reducedMotion = useReducedMotion();
  const dragStart = useRef<StageLayout | null>(null);

  useEffect(() => setWebgl(hasWebGL()), []);

  const dirty = JSON.stringify(layout.items) !== savedJson;
  const selected = layout.items.find((i) => i.id === selectedId) ?? null;

  const onDragStart = useCallback(() => {
    dragStart.current = history.present;
  }, [history.present]);
  const onDrag = useCallback(
    (id: string, position: Vec3) => {
      if (!canEdit) return;
      dispatch({ type: "replace", value: moveItem(history.present, id, position) });
    },
    [history.present, canEdit]
  );
  const onDragEnd = useCallback(() => {
    if (dragStart.current) dispatch({ type: "commit", from: dragStart.current });
    dragStart.current = null;
  }, []);

  const step = useCallback(
    (fn: (l: StageLayout) => StageLayout) => {
      if (!canEdit) return;
      dispatch({ type: "set", value: fn(history.present) });
    },
    [history.present, canEdit]
  );

  // Keyboard: arrows nudge, Q/E rotate, Ctrl+Z / Ctrl+Shift+Z undo/redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && k === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
        return;
      }
      if (!selectedId || e.ctrlKey || e.metaKey || e.altKey) return;
      const d = e.shiftKey ? GRID_STEP * 4 : GRID_STEP;
      const moves: Record<string, [number, number]> = { arrowleft: [-d, 0], arrowright: [d, 0], arrowup: [0, -d], arrowdown: [0, d] };
      if (moves[k]) {
        e.preventDefault();
        step((l) => nudgeItem(l, selectedId, moves[k]![0], moves[k]![1]));
      } else if (k === "q" || k === "e") {
        step((l) => rotateItem(l, selectedId, (k === "q" ? 1 : -1) * (Math.PI / 12)));
      } else if (k === "escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, step]);

  async function save() {
    setBusy("save");
    setResult(null);
    const res = await studioFetch<{ layout: StageLayout }>("/api/studio/stage", "PUT", layout);
    setBusy(null);
    if (res.ok) {
      setSavedJson(JSON.stringify(res.data.layout.items));
      setLastSaved(res.data.layout.updatedAt);
      setResult({ ok: true, message: "Layout saved" });
    } else {
      setResult({ ok: false, message: res.message, details: describeDetails(res.details) });
    }
  }

  async function publishStage() {
    setBusy("publish");
    setResult(null);
    const res = await studioFetch<{ version: { id: string; version: number; publishedAt: string } }>("/api/studio/stage/publish", "POST");
    setBusy(null);
    if (res.ok) {
      setPublished(res.data.version);
      setVersionCount((n) => n + 1);
      setResult({ ok: true, message: `Published stage v${res.data.version.version}. Fans now see this layout.` });
    } else setResult({ ok: false, message: res.message, details: describeDetails(res.details) });
  }

  async function unpublishStage() {
    if (!window.confirm("Unpublish the stage? Fans will no longer be able to open it.")) return;
    setBusy("unpublish");
    const res = await studioFetch("/api/studio/stage/publish", "DELETE");
    setBusy(null);
    if (res.ok) {
      setPublished(null);
      setResult({ ok: true, message: "Stage unpublished. The public page is now closed." });
    } else setResult({ ok: false, message: res.message });
  }

  async function restore() {
    setBusy("restore");
    const res = await studioFetch<{ layout: StageLayout; saved: boolean }>("/api/studio/stage");
    setBusy(null);
    if (res.ok) {
      dispatch({ type: "reset", value: res.data.layout });
      setSavedJson(JSON.stringify(res.data.layout.items));
      setResult({ ok: true, message: res.data.saved ? "Restored the last saved layout" : "No saved layout yet — showing the default" });
    } else setResult({ ok: false, message: res.message });
  }

  const btn = "h-10 min-w-10 px-3 text-sm border border-[var(--color-border-strong)] hover:border-[var(--color-fg)] disabled:opacity-40 disabled:hover:border-[var(--color-border-strong)]";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Stage tools">
        <div className="flex" role="group" aria-label="Camera view">
          {VIEWS.map((v) => (
            <button key={v.name} type="button" aria-pressed={view.name === v.name} onClick={() => setView((s) => ({ name: v.name, nonce: s.nonce + 1 }))} className={`${btn} -ml-px first:ml-0 ${view.name === v.name ? "bg-white/[0.08] border-[var(--color-fg)]" : ""}`}>
              {v.label}
            </button>
          ))}
        </div>
        <button type="button" className={btn} onClick={() => setView((s) => ({ name: "perspective", nonce: s.nonce + 1 }))}>Reset camera</button>
        <span className="mx-1 h-6 w-px bg-[var(--color-border)]" aria-hidden="true" />
        <button type="button" className={btn} onClick={() => dispatch({ type: "undo" })} disabled={history.past.length === 0} title="Undo (Ctrl+Z)">Undo</button>
        <button type="button" className={btn} onClick={() => dispatch({ type: "redo" })} disabled={history.future.length === 0} title="Redo (Ctrl+Shift+Z)">Redo</button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-[var(--color-fg-muted)]" aria-live="polite">{dirty ? "Unsaved changes" : lastSaved ? "Saved" : "Default layout"}</span>
          <button type="button" className={btn} onClick={() => void restore()} disabled={busy !== null}>Restore saved</button>
          {canEdit && (
            <>
              <button type="button" className={btn} onClick={() => step(() => defaultStageLayout(layout.artistId))}>Default layout</button>
              <button type="button" onClick={() => void save()} disabled={busy !== null || !dirty} className="h-10 px-4 text-sm font-semibold bg-[var(--color-accent)] text-white disabled:opacity-40">
                {busy === "save" ? "Saving…" : "Save layout"}
              </button>
            </>
          )}
        </div>
      </div>
      <FormMessage result={result} />

      <section aria-label="Public stage" className="flex flex-wrap items-center gap-3 border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm">
        <span className={`inline-flex items-center px-2 py-0.5 border text-[11px] font-mono uppercase tracking-wider ${published ? "border-emerald-500/50 text-emerald-400" : "border-[var(--color-border-strong)] text-[var(--color-fg-muted)]"}`}>
          {published ? "Public" : "Not public"}
        </span>
        <span className="text-[var(--color-fg-muted)]">
          {published ? `Fans see v${published.version}` : versionCount > 0 ? "Unpublished — fans cannot open the stage" : "Never published"}
        </span>
        {published && (
          <a href={`/artists/${publish.artistSlug}/stage`} target="_blank" rel="noreferrer" className="underline underline-offset-4">
            Open public stage
          </a>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {publish.canPublish ? (
            <>
              <button
                type="button"
                className={btn}
                onClick={() => void publishStage()}
                disabled={busy !== null || dirty || !lastSaved}
                title={dirty ? "Save the layout first" : !lastSaved ? "Save the layout first" : "Publish the saved layout"}
              >
                {busy === "publish" ? "Publishing…" : published ? "Publish new version" : "Publish stage"}
              </button>
              {published && (
                <button type="button" className={btn} onClick={() => void unpublishStage()} disabled={busy !== null}>
                  Unpublish
                </button>
              )}
            </>
          ) : (
            <span className="text-xs text-[var(--color-fg-muted)]">An artist admin publishes the stage.</span>
          )}
        </div>
        {publish.canPublish && (dirty || !lastSaved) && <p className="w-full text-xs text-[var(--color-fg-muted)]">Only the saved layout can be published. Save your changes first.</p>}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="relative w-full overflow-hidden border border-[var(--color-border)] bg-black aspect-[4/3] md:aspect-[16/9]" data-testid="stage-viewport">
          {webgl === false ? (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-[var(--color-fg-muted)]">
              3D needs WebGL, which this browser has turned off. You can still arrange the stage with the item list.
            </div>
          ) : webgl ? (
            <StageCanvas
              mode="edit"
              items={layout.items}
              selectedId={selectedId}
              view={view}
              reducedMotion={reducedMotion}
              onSelect={setSelectedId}
              onDrag={onDrag}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onCameraChange={setCamera}
            />
          ) : null}
          <p className="pointer-events-none absolute bottom-2 left-2 right-2 text-[11px] text-[var(--color-fg-muted)]">
            Drag to orbit · right-drag or two fingers to pan · scroll or pinch to zoom · drag a member or instrument to move it
          </p>
        </div>

        <aside className="flex flex-col gap-4">
          <section className="border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <h2 className="px-3 py-2 border-b border-[var(--color-border)] text-xs font-mono font-semibold uppercase tracking-widest text-[var(--color-fg-muted)]">Stage items</h2>
            <ul className="max-h-72 overflow-y-auto divide-y divide-[var(--color-border)]">
              {layout.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    aria-pressed={item.id === selectedId}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${item.id === selectedId ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.kind === "performer" ? "#38a8ff" : isMovable(item) ? "#a3a3a3" : "#e8192c" }} />
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span className="text-[10px] font-mono uppercase text-[var(--color-fg-muted)]">{isMovable(item) ? item.kind : "locked"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 text-sm" aria-live="polite">
            {selected ? (
              <>
                <p className="font-medium">{selected.label}</p>
                <p className="mt-1 font-mono text-xs text-[var(--color-fg-muted)]">
                  x {selected.position[0].toFixed(2)} · z {selected.position[2].toFixed(2)} · {Math.round((selected.rotationY * 180) / Math.PI)}°
                </p>
                {isMovable(selected) && canEdit ? (
                  <div className="mt-3 grid grid-cols-3 gap-1 w-max" role="group" aria-label={`Move ${selected.label}`}>
                    <button type="button" className={btn} onClick={() => step((l) => rotateItem(l, selected.id, Math.PI / 12))} aria-label="Rotate left">⟲</button>
                    <button type="button" className={btn} onClick={() => step((l) => nudgeItem(l, selected.id, 0, -GRID_STEP))} aria-label="Move upstage">↑</button>
                    <button type="button" className={btn} onClick={() => step((l) => rotateItem(l, selected.id, -Math.PI / 12))} aria-label="Rotate right">⟳</button>
                    <button type="button" className={btn} onClick={() => step((l) => nudgeItem(l, selected.id, -GRID_STEP, 0))} aria-label="Move stage right">←</button>
                    <button type="button" className={btn} onClick={() => step((l) => nudgeItem(l, selected.id, 0, GRID_STEP))} aria-label="Move downstage">↓</button>
                    <button type="button" className={btn} onClick={() => step((l) => nudgeItem(l, selected.id, GRID_STEP, 0))} aria-label="Move stage left">→</button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[var(--color-accent)]">{isMovable(selected) ? "Read-only for your role." : "Locked in place — amplifiers and drums cannot be moved."}</p>
                )}
                <p className="mt-3 text-[11px] text-[var(--color-fg-muted)]">Keyboard: arrows move (Shift = 1 m), Q / E rotate, Esc deselect.</p>
              </>
            ) : (
              <p className="text-[var(--color-fg-muted)]">Select a member or instrument on the stage or in the list.</p>
            )}
          </section>
        </aside>
      </div>

      {/* Machine-readable state for automated tests; hidden from assistive tech. */}
      <output
        hidden
        aria-hidden="true"
        data-testid="stage-state"
        data-view={view.name}
        data-camera={camera ? JSON.stringify(camera) : ""}
        data-items={JSON.stringify(layout.items.map((i) => ({ id: i.id, p: i.position, r: i.rotationY })))}
      />
    </div>
  );
}
