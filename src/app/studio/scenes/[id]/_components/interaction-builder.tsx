"use client";

import { createInteraction } from "@/lib/studio/scene-objects";
import type { InteractionInput, InteractionMapping, InteractionOutput, SceneObject } from "@/types";
import type { ManualAudio } from "./scene-preview";

export const INPUT_LABELS: Record<InteractionInput, string> = {
  audio_bass: "Audio · bass",
  audio_mid: "Audio · mid",
  audio_treble: "Audio · treble",
  audio_volume: "Audio · volume",
  audio_frequency: "Audio · frequency",
  pointer_move_x: "Pointer · X position",
  pointer_move_y: "Pointer · Y position",
  pointer_click: "Pointer · click",
  pointer_drag_x: "Pointer · drag X",
  pointer_drag_y: "Pointer · drag Y",
  scroll_y: "Page scroll",
  // Matches the current engine: 0 before playback, 1 after it starts (no time windows yet).
  timeline_trigger: "Timeline · after playback starts (0→1)",
};

export const OUTPUT_LABELS: Record<InteractionOutput, string> = {
  position_x: "Position X",
  position_y: "Position Y",
  scale_x: "Scale X",
  scale_y: "Scale Y",
  rotation: "Rotation",
  opacity: "Opacity",
  color_hue: "Color hue shift",
  color_brightness: "Brightness",
  visibility: "Visibility",
  particle_count: "Particle count",
  particle_speed: "Particle speed",
  scene_transition: "Scene transition",
};

const selectCls = "h-8 w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-2 text-sm text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-fg)]";
const numCls = "h-8 w-full bg-transparent border border-[var(--color-border)] px-2 text-sm font-mono text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-fg)]";

export function InteractionBuilder({
  objects,
  interactions,
  onChange,
  selectedObjectId,
  manualAudio,
  onManualAudio,
}: {
  objects: SceneObject[];
  interactions: InteractionMapping[];
  onChange: (next: InteractionMapping[]) => void;
  selectedObjectId: string | null;
  manualAudio: ManualAudio | null;
  onManualAudio: (m: ManualAudio | null) => void;
}) {
  const update = (id: string, patch: Partial<InteractionMapping>) => onChange(interactions.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const nameOf = (id: string) => objects.find((o) => o.id === id)?.name ?? "missing object";
  const targetId = selectedObjectId ?? objects[0]?.id ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--color-fg-muted)]">
          Map an input to an object property. Output = input range mapped to output range, with easing and smoothing.
        </p>
        <button
          type="button"
          disabled={!targetId || interactions.length >= 500}
          onClick={() => targetId && onChange([...interactions, createInteraction(targetId)])}
          className="shrink-0 h-8 px-3 text-xs font-semibold bg-[var(--color-accent)] text-white disabled:opacity-40"
        >
          Add mapping
        </button>
      </div>
      {!targetId && <p className="text-sm text-[var(--color-fg-muted)]">Add an object first.</p>}

      <ol className="flex flex-col gap-3">
        {interactions.map((m, i) => (
          <li key={m.id} className="border border-[var(--color-border)] p-3 flex flex-col gap-2" aria-label={`Mapping ${i + 1}: ${INPUT_LABELS[m.input]} to ${OUTPUT_LABELS[m.output]} on ${nameOf(m.objectId)}`}>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
                Object
                <select value={m.objectId} onChange={(e) => update(m.id, { objectId: e.target.value })} className={selectCls}>
                  {objects.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
                Input
                <select value={m.input} onChange={(e) => update(m.id, { input: e.target.value as InteractionInput })} className={selectCls}>
                  {Object.entries(INPUT_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
                Output
                <select value={m.output} onChange={(e) => update(m.id, { output: e.target.value as InteractionOutput })} className={selectCls}>
                  {Object.entries(OUTPUT_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-6 items-end">
              {(["inputMin", "inputMax", "outputMin", "outputMax"] as const).map((k) => (
                <label key={k} className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
                  {k.replace(/(Min|Max)$/, " $1").replace("input", "In").replace("output", "Out")}
                  <input
                    type="number"
                    step="any"
                    value={m[k]}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value);
                      if (!Number.isNaN(n)) update(m.id, { [k]: n });
                    }}
                    className={numCls}
                  />
                </label>
              ))}
              <label className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
                Easing
                <select value={m.easing} onChange={(e) => update(m.id, { easing: e.target.value as InteractionMapping["easing"] })} className={selectCls}>
                  <option value="linear">linear</option>
                  <option value="ease_in">ease in</option>
                  <option value="ease_out">ease out</option>
                  <option value="ease_in_out">ease in-out</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
                Smoothing {m.smoothing.toFixed(2)}
                <input type="range" min={0} max={1} step={0.05} value={m.smoothing} onChange={(e) => update(m.id, { smoothing: parseFloat(e.target.value) })} className="h-8 accent-[var(--color-accent)]" />
              </label>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => onChange(interactions.filter((x) => x.id !== m.id))} className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-accent)]">
                Remove mapping
              </button>
            </div>
          </li>
        ))}
      </ol>

      <fieldset className="border border-[var(--color-border)] p-3">
        <legend className="px-1 text-xs font-mono uppercase tracking-widest text-[var(--color-fg-muted)]">Test audio</legend>
        <label className="flex items-center gap-2 text-sm mb-2">
          <input type="checkbox" checked={manualAudio !== null} onChange={(e) => onManualAudio(e.target.checked ? { bass: 0.5, mid: 0.3, treble: 0.2 } : null)} />
          Drive the preview with these values instead of simulated audio
        </label>
        {manualAudio && (
          <div className="grid gap-2 sm:grid-cols-3">
            {(["bass", "mid", "treble"] as const).map((band) => (
              <label key={band} className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
                {band} {manualAudio[band].toFixed(2)}
                <input type="range" min={0} max={1} step={0.01} value={manualAudio[band]} onChange={(e) => onManualAudio({ ...manualAudio, [band]: parseFloat(e.target.value) })} className="accent-[var(--color-accent)]" />
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
}
