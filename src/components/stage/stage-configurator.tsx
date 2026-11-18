"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  CURRENT_BACKLINE,
  GRID_STEP,
  backlineOf,
  defaultStageLayout,
  upgradeBackline,
  historyReducer,
  initHistory,
  isMovable,
  moveItem,
  performerRole,
  ROLE_STYLES,
  nudgeItem,
  rotateItem,
  type CameraView,
  type StageItem,
  type StageLayout,
  type Vec3,
} from "@/lib/stage";
import { studioFetch, describeDetails } from "@/components/studio/client-api";
import { FormMessage } from "@/components/studio/ui";
import { formatTime } from "@/lib/utils/format";

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
  const [focus, setFocus] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
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
      if (k === "escape") setFocus(false);
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

  const btn =
    "h-9 min-w-9 shrink-0 px-3 text-sm border border-[var(--color-border-strong)] hover:border-[var(--color-fg)] disabled:opacity-40 disabled:hover:border-[var(--color-border-strong)]";
  const members = layout.items.filter((i) => i.kind === "performer");
  const gear = layout.items.filter((i) => i.kind !== "performer");
  const role = selected ? performerRole(selected) : null;
  const savedTime = lastSaved ? formatTime(lastSaved) : null;

  const itemButton = (item: StageItem) => {
    const r = performerRole(item);
    const color = r ? ROLE_STYLES[r].color : isMovable(item) ? "#a7a5a0" : "#e44942";
    return (
      <li key={item.id}>
        <button
          type="button"
          onClick={() => setSelectedId(item.id)}
          aria-pressed={item.id === selectedId}
          className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${item.id === selectedId ? "bg-white/[0.07]" : "hover:bg-white/[0.03]"}`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: color, borderRadius: r ? 9999 : 2 }} />
            <span className="truncate">{item.label}</span>
          </span>
          <span className="text-[10px] font-mono uppercase text-[var(--color-fg-muted)]">{isMovable(item) ? (r ? "performer" : item.kind) : "locked"}</span>
        </button>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar: camera on the left, history on the right; scrolls horizontally on phones */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1" role="toolbar" aria-label="Stage tools">
        <div className="flex shrink-0" role="group" aria-label="Camera view">
          {VIEWS.map((v) => (
            <button
              key={v.name}
              type="button"
              aria-pressed={view.name === v.name}
              onClick={() => setView((s) => ({ name: v.name, nonce: s.nonce + 1 }))}
              className={`${btn} -ml-px first:ml-0 ${view.name === v.name ? "bg-white/[0.08] border-[var(--color-fg)]" : ""}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <button type="button" className={btn} onClick={() => setView((s) => ({ name: "perspective", nonce: s.nonce + 1 }))}>
          Reset camera
        </button>
        <button type="button" className={btn} aria-pressed={showLabels} onClick={() => setShowLabels((v) => !v)}>
          Labels
        </button>
        <button type="button" className={btn} aria-pressed={focus} onClick={() => setFocus((v) => !v)} title="Focus the viewport (Esc to exit)">
          {focus ? "Exit focus" : "Focus"}
        </button>
        <span className="mx-1 h-6 w-px shrink-0 bg-[var(--color-border)]" aria-hidden="true" />
        <button type="button" className={btn} onClick={() => dispatch({ type: "undo" })} disabled={history.past.length === 0} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button type="button" className={btn} onClick={() => dispatch({ type: "redo" })} disabled={history.future.length === 0} title="Redo (Ctrl+Shift+Z)">
          Redo
        </button>
      </div>

      {canEdit && backlineOf(layout) < CURRENT_BACKLINE && (
        <div role="note" className="flex flex-wrap items-center gap-3 border border-[var(--stage-amber)]/50 bg-[var(--color-bg-secondary)] px-3 py-2 text-sm">
          <span className="text-[var(--color-fg)]">
            This draft uses the previous backline (amps on the old sides). Your members and instruments stay where they are.
          </span>
          <button type="button" className={btn} onClick={() => step((l) => upgradeBackline(l))}>
            Update backline
          </button>
          <span className="text-xs text-[var(--color-fg-muted)]">Nothing changes until you save.</span>
        </div>
      )}

      {/* Status bar: draft save state + public state */}
      <div className="flex flex-wrap items-center gap-2 border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm" aria-label="Layout status">
        <span className="flex items-center gap-2 text-xs font-mono" aria-live="polite">
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: dirty ? "var(--stage-amber)" : "var(--stage-cyan)" }} />
          {dirty ? "Unsaved changes" : savedTime ? `Saved ${savedTime}` : "Default layout"}
        </span>
        <span
          className={`inline-flex items-center px-2 py-0.5 border text-[11px] font-mono uppercase tracking-wider ${published ? "border-emerald-500/50 text-emerald-400" : "border-[var(--color-border-strong)] text-[var(--color-fg-muted)]"}`}
        >
          {published ? "Public" : "Not public"}
        </span>
        <span className="text-xs text-[var(--color-fg-muted)]">
          {published ? `Fans see v${published.version}` : versionCount > 0 ? "Unpublished — fans cannot open the stage" : "Never published"}
        </span>
        {published && (
          <a href={`/artists/${publish.artistSlug}/stage`} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-4">
            Open public stage
          </a>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" className={btn} onClick={() => void restore()} disabled={busy !== null}>
            Restore saved
          </button>
          {canEdit && (
            <>
              <button type="button" className={btn} onClick={() => step(() => defaultStageLayout(layout.artistId))}>
                Default layout
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy !== null || !dirty}
                className="h-9 px-4 text-sm font-semibold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-40"
              >
                {busy === "save" ? "Saving…" : "Save layout"}
              </button>
            </>
          )}
          {publish.canPublish ? (
            <>
              <button
                type="button"
                className={btn}
                onClick={() => void publishStage()}
                disabled={busy !== null || dirty || !lastSaved}
                title={dirty || !lastSaved ? "Save the layout first" : "Publish the saved layout"}
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
        {publish.canPublish && (dirty || !lastSaved) && (
          <p className="w-full text-xs text-[var(--color-fg-muted)]">Only the saved layout can be published. Save your changes first.</p>
        )}
      </div>
      <FormMessage result={result} />

      <div className={`stage-theme grid gap-3 ${focus ? "grid-cols-1" : "xl:grid-cols-[220px_minmax(0,1fr)_280px]"}`}>
        {/* Left — session members and objects */}
        {!focus && (
          <aside className="order-2 xl:order-1 flex flex-col gap-3" aria-label="Stage objects">
            {[
              { title: "Session members", list: members },
              { title: "Instruments & backline", list: gear },
            ].map((g) => (
              <section key={g.title} className="border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <h2 className="px-3 py-2 border-b border-[var(--color-border)] text-xs font-mono font-semibold uppercase tracking-widest text-[var(--color-fg-muted)]">
                  {g.title}
                </h2>
                <ul className="divide-y divide-[var(--color-border)]">{g.list.map(itemButton)}</ul>
              </section>
            ))}
          </aside>
        )}

        {/* Center — interactive stage */}
        <div
          className={`order-1 xl:order-2 relative w-full overflow-hidden border border-[var(--color-border)] bg-[var(--stage-void)] ${focus ? "h-[78vh] min-h-[420px]" : "aspect-[4/3] md:aspect-[16/9]"}`}
          data-testid="stage-viewport"
        >
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
              showLabels={showLabels}
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

        {/* Right — inspector */}
        {!focus && (
          <aside className="order-3 self-start border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 text-sm" aria-label="Inspector" aria-live="polite">
            <h2 className="mb-3 text-xs font-mono font-semibold uppercase tracking-widest text-[var(--color-fg-muted)]">Inspector</h2>
            {selected ? (
              <>
                <p className="flex items-center gap-2 font-medium">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: role ? ROLE_STYLES[role].color : isMovable(selected) ? "#a7a5a0" : "#e44942" }}
                  />
                  {selected.label}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">{role ? `${ROLE_STYLES[role].label} hologram` : selected.kind}</p>
                <dl className="mt-3 grid grid-cols-3 gap-2 font-mono text-xs">
                  <div>
                    <dt className="text-[var(--color-fg-muted)]">X</dt>
                    <dd>{selected.position[0].toFixed(2)} m</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-fg-muted)]">Z</dt>
                    <dd>{selected.position[2].toFixed(2)} m</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-fg-muted)]">Rot</dt>
                    <dd>{Math.round((selected.rotationY * 180) / Math.PI)}°</dd>
                  </div>
                </dl>
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs" style={{ color: isMovable(selected) ? "var(--stage-cyan)" : "var(--aii-signal)" }}>
                  <span aria-hidden="true">{isMovable(selected) ? "◇" : "■"}</span>
                  {isMovable(selected) ? "Movable" : "Locked in place — amplifiers and drums cannot be moved."}
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
                ) : isMovable(selected) ? (
                  <p className="mt-2 text-xs text-[var(--color-fg-muted)]">Read-only for your role.</p>
                ) : null}
                <p className="mt-3 text-[11px] text-[var(--color-fg-muted)]">Keyboard: arrows move (Shift = 1 m), Q / E rotate, Esc deselect.</p>
              </>
            ) : (
              <p className="text-[var(--color-fg-muted)]">Select a member or instrument on the stage or in the list.</p>
            )}
          </aside>
        )}
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
