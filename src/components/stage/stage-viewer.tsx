"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ReactNode } from "react";
import { ROLE_STYLES, performerRole, type CameraView, type StageItem, type StageItemKind, type Vec3 } from "@/lib/stage";

// Same renderer as the Studio editor, mounted in read-only "view" mode.
const StageCanvas = dynamic(() => import("./stage-canvas").then((m) => m.StageCanvas), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-sm text-[var(--color-fg-muted)]" role="status">
      Loading stage…
    </div>
  ),
});

const VIEWS: { name: CameraView; label: string }[] = [
  { name: "perspective", label: "Perspective" },
  { name: "top", label: "Top" },
  { name: "front", label: "Front" },
  { name: "side", label: "Side" },
];

const KIND_INFO: Record<StageItemKind, string> = {
  performer: "Hologram band member",
  guitar: "Guitar",
  bass: "Bass guitar",
  keyboard: "Keyboard",
  mic: "Vocal microphone",
  amplifier: "Amplifier (backline)",
  drums: "Drum kit (backline)",
};

/** Catches WebGL context/render failures so the page shows a fallback instead of crashing. */
class CanvasBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function StageViewer({ items, artistName }: { items: StageItem[]; artistName: string }) {
  const [view, setView] = useState<{ name: CameraView; nonce: number }>({ name: "perspective", nonce: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [camera, setCamera] = useState<{ position: Vec3; target: Vec3 } | null>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showLabels, setShowLabels] = useState(true);

  useEffect(() => {
    setWebgl(webglAvailable());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const on = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const members = items.filter((i) => i.kind === "performer");
  const gear = items.filter((i) => i.kind !== "performer");
  const btn = "h-9 min-w-9 shrink-0 px-3 text-sm border border-[var(--color-border-strong)] hover:border-[var(--color-fg)]";
  const dot = (item: StageItem) => {
    const r = performerRole(item);
    return r ? ROLE_STYLES[r].color : item.kind === "amplifier" || item.kind === "drums" ? "#e44942" : "#a7a5a0";
  };
  const selectedRole = selected ? performerRole(selected) : null;

  const fallback = (
    <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-[var(--color-fg-muted)]">
      <div>
        <p className="font-medium text-[var(--color-fg)]">The 3D stage can&apos;t be shown in this browser.</p>
        <p className="mt-1">WebGL is turned off or unavailable. The lineup is listed below.</p>
      </div>
    </div>
  );

  if (items.length === 0) {
    return <p className="border border-dashed border-[var(--color-border-strong)] px-6 py-10 text-center text-sm">This stage is empty.</p>;
  }

  return (
    <div className="stage-theme flex flex-col gap-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-1" role="toolbar" aria-label="Camera">
        <div className="flex" role="group" aria-label="Camera view">
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
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div
          className="relative w-full overflow-hidden border border-[var(--color-border)] bg-[var(--stage-void)] aspect-[4/3] md:aspect-[16/9]"
          data-testid="stage-viewport"
          aria-label={`${artistName} 3D stage`}
          role="img"
        >
          {webgl === false ? (
            fallback
          ) : webgl ? (
            <CanvasBoundary fallback={fallback}>
              <StageCanvas
                mode="view"
                items={items}
                selectedId={selectedId}
                view={view}
                reducedMotion={reducedMotion}
                showLabels={showLabels}
                onSelect={setSelectedId}
                onCameraChange={setCamera}
              />
            </CanvasBoundary>
          ) : null}
          <p className="pointer-events-none absolute bottom-2 left-2 right-2 text-[11px] text-[var(--color-fg-muted)]">
            Drag to orbit · two fingers or right-drag to pan · pinch or scroll to zoom · tap a member for details
          </p>
        </div>

        <aside className="flex flex-col gap-4">
          <section className="border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 min-h-28" aria-live="polite">
            {selected ? (
              <>
                <p className="text-xs font-mono uppercase tracking-widest" style={{ color: dot(selected) }}>
                  {selectedRole ? `${ROLE_STYLES[selectedRole].label} · hologram band member` : KIND_INFO[selected.kind]}
                </p>
                <p className="mt-1 text-lg font-semibold">{selected.label}</p>
                <p className="mt-1 font-mono text-xs text-[var(--color-fg-muted)]">
                  {selected.position[2] > 1 ? "Downstage" : selected.position[2] < -1 ? "Upstage" : "Center stage"}
                  {" · "}
                  {selected.position[0] < -1 ? "stage right" : selected.position[0] > 1 ? "stage left" : "center"}
                </p>
              </>
            ) : (
              <p className="text-sm text-[var(--color-fg-muted)]">Tap a member or instrument to see who&apos;s where.</p>
            )}
          </section>
          {[
            { title: "Lineup", list: members },
            { title: "On stage", list: gear },
          ].map((group) => (
            <section key={group.title} className="border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <h2 className="px-3 py-2 border-b border-[var(--color-border)] text-xs font-mono font-semibold uppercase tracking-widest text-[var(--color-fg-muted)]">{group.title}</h2>
              <ul className="divide-y divide-[var(--color-border)]">
                {group.list.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={item.id === selectedId}
                      onClick={() => setSelectedId(item.id)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${item.id === selectedId ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}
                    >
                      <span aria-hidden="true" className="h-2.5 w-2.5" style={{ backgroundColor: dot(item), borderRadius: item.kind === "performer" ? 9999 : 2 }} />
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </aside>
      </div>

      <output
        hidden
        aria-hidden="true"
        data-testid="stage-state"
        data-view={view.name}
        data-camera={camera ? JSON.stringify(camera) : ""}
        data-items={JSON.stringify(items.map((i) => ({ id: i.id, p: i.position, r: i.rotationY })))}
      />
    </div>
  );
}
