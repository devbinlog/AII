"use client";

import type { SceneObject } from "@/types";

type Patch = (fn: (o: SceneObject) => SceneObject) => void;

function NumberField({
  id,
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
      {label}
      <input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!Number.isNaN(n)) onChange(min !== undefined || max !== undefined ? Math.min(max ?? n, Math.max(min ?? n, n)) : n);
        }}
        className="h-8 w-full bg-transparent border border-[var(--color-border)] px-2 text-sm text-[var(--color-fg)] font-mono focus:outline-none focus:border-[var(--color-fg)]"
      />
    </label>
  );
}

function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string | null; onChange: (v: string) => void }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
      <input
        id={id}
        type="color"
        value={value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff"}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 shrink-0 cursor-pointer border border-[var(--color-border)] bg-transparent"
      />
      <span>
        {label}
        <span className="block font-mono text-[var(--color-fg)]">{value ?? "none"}</span>
      </span>
    </label>
  );
}

const selectCls = "h-8 w-full bg-[var(--color-bg)] border border-[var(--color-border)] px-2 text-sm text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-fg)]";

export function ObjectInspector({ object, patch, images }: { object: SceneObject; patch: Patch; images: { id: string; filename: string }[] }) {
  const t = object.transform;
  const setT = (key: keyof SceneObject["transform"], v: number) => patch((o) => ({ ...o, transform: { ...o.transform, [key]: v } }));
  const setStyle = (key: keyof SceneObject["style"], v: SceneObject["style"][keyof SceneObject["style"]]) =>
    patch((o) => ({ ...o, style: { ...o.style, [key]: v } }));
  const p = `insp-${object.id}`;
  const d = object.data;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
        <label htmlFor={`${p}-name`}>Name</label>
        <input
          id={`${p}-name`}
          value={object.name}
          maxLength={256}
          onChange={(e) => patch((o) => ({ ...o, name: e.target.value || "Untitled" }))}
          className="h-9 bg-transparent border border-[var(--color-border)] px-2 text-sm text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-fg)]"
        />
      </div>

      {d.type === "text" && (
        <div className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
          <label htmlFor={`${p}-content`}>Text</label>
          <textarea
            id={`${p}-content`}
            value={d.content}
            maxLength={500}
            rows={2}
            onChange={(e) => patch((o) => ({ ...o, data: { type: "text", content: e.target.value } }))}
            className="bg-transparent border border-[var(--color-border)] px-2 py-1 text-sm text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-fg)]"
          />
        </div>
      )}

      {d.type === "image" && (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${p}-asset`} className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
            Image asset
            <select id={`${p}-asset`} value={d.assetId} onChange={(e) => patch((o) => ({ ...o, data: { ...d, assetId: e.target.value } }))} className={selectCls}>
              {images.map((img) => (
                <option key={img.id} value={img.id}>{img.filename}</option>
              ))}
            </select>
          </label>
          <label htmlFor={`${p}-alt`} className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
            Alt text
            <input id={`${p}-alt`} value={d.alt} maxLength={300} onChange={(e) => patch((o) => ({ ...o, data: { ...d, alt: e.target.value } }))} className="h-8 bg-transparent border border-[var(--color-border)] px-2 text-sm text-[var(--color-fg)]" />
          </label>
        </div>
      )}

      {d.type === "shape" && (
        <label htmlFor={`${p}-variant`} className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
          Shape
          <select id={`${p}-variant`} value={d.variant} onChange={(e) => patch((o) => ({ ...o, data: { type: "shape", variant: e.target.value as typeof d.variant } }))} className={selectCls}>
            {["rectangle", "circle", "ellipse", "triangle", "line", "polygon"].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
      )}

      {d.type === "waveform" && (
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="mb-2 text-xs font-mono uppercase tracking-widest text-[var(--color-fg-muted)]">Waveform</legend>
          <NumberField id={`${p}-bars`} label="Bars" value={d.config.barCount} min={4} max={128} onChange={(v) => patch((o) => ({ ...o, data: { type: "waveform", config: { ...d.config, barCount: Math.round(v) } } }))} />
          <label htmlFor={`${p}-wstyle`} className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
            Style
            <select id={`${p}-wstyle`} value={d.config.style} onChange={(e) => patch((o) => ({ ...o, data: { type: "waveform", config: { ...d.config, style: e.target.value as typeof d.config.style } } }))} className={selectCls}>
              <option value="bars">bars</option>
              <option value="wave">wave</option>
              <option value="circular">circular</option>
            </select>
          </label>
          <div className="col-span-2">
            <ColorField id={`${p}-wcolor`} label="Color" value={d.config.color} onChange={(v) => patch((o) => ({ ...o, data: { type: "waveform", config: { ...d.config, color: v } } }))} />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
            <input type="checkbox" checked={d.config.mirror} onChange={(e) => patch((o) => ({ ...o, data: { type: "waveform", config: { ...d.config, mirror: e.target.checked } } }))} />
            Mirror
          </label>
        </fieldset>
      )}

      {d.type === "particle" && (
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="mb-2 text-xs font-mono uppercase tracking-widest text-[var(--color-fg-muted)]">Particles</legend>
          <NumberField id={`${p}-count`} label="Count" value={d.config.count} min={1} max={500} onChange={(v) => patch((o) => ({ ...o, data: { type: "particle", config: { ...d.config, count: Math.round(v) } } }))} />
          <NumberField id={`${p}-size`} label="Size" value={d.config.size} min={1} max={64} onChange={(v) => patch((o) => ({ ...o, data: { type: "particle", config: { ...d.config, size: v } } }))} />
          <NumberField id={`${p}-speed`} label="Speed" value={d.config.speed} step={0.1} min={0} max={10} onChange={(v) => patch((o) => ({ ...o, data: { type: "particle", config: { ...d.config, speed: v } } }))} />
          <label htmlFor={`${p}-pshape`} className="flex flex-col gap-1 text-xs text-[var(--color-fg-muted)]">
            Shape
            <select id={`${p}-pshape`} value={d.config.shape} onChange={(e) => patch((o) => ({ ...o, data: { type: "particle", config: { ...d.config, shape: e.target.value as typeof d.config.shape } } }))} className={selectCls}>
              <option value="circle">circle</option>
              <option value="square">square</option>
              <option value="star">star</option>
            </select>
          </label>
          <div className="col-span-2">
            <ColorField id={`${p}-pcolor`} label="Color" value={d.config.color} onChange={(v) => patch((o) => ({ ...o, data: { type: "particle", config: { ...d.config, color: v } } }))} />
          </div>
        </fieldset>
      )}

      <fieldset className="grid grid-cols-2 gap-2 disabled:opacity-60" disabled={object.locked} aria-describedby={object.locked ? `${p}-locked` : undefined}>
        <legend className="mb-2 text-xs font-mono uppercase tracking-widest text-[var(--color-fg-muted)]">Transform</legend>
        {object.locked && (
          <p id={`${p}-locked`} className="col-span-2 text-xs text-[var(--color-fg-muted)]">
            Locked. Unlock the layer to move, resize or rotate it.
          </p>
        )}
        <NumberField id={`${p}-x`} label="X" value={t.x} onChange={(v) => setT("x", v)} />
        <NumberField id={`${p}-y`} label="Y" value={t.y} onChange={(v) => setT("y", v)} />
        <NumberField id={`${p}-w`} label="Width" value={t.width} min={0} onChange={(v) => setT("width", v)} />
        <NumberField id={`${p}-h`} label="Height" value={t.height} min={0} onChange={(v) => setT("height", v)} />
        <NumberField id={`${p}-rot`} label="Rotation°" value={t.rotation} onChange={(v) => setT("rotation", v)} />
        <NumberField id={`${p}-op`} label="Opacity" value={t.opacity} step={0.05} min={0} max={1} onChange={(v) => setT("opacity", v)} />
        <NumberField id={`${p}-sx`} label="Scale X" value={t.scaleX} step={0.05} onChange={(v) => setT("scaleX", v)} />
        <NumberField id={`${p}-sy`} label="Scale Y" value={t.scaleY} step={0.05} onChange={(v) => setT("scaleY", v)} />
      </fieldset>

      {d.type !== "image" && d.type !== "particle" && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs font-mono uppercase tracking-widest text-[var(--color-fg-muted)]">Style</legend>
          <ColorField id={`${p}-fill`} label="Fill" value={object.style.fill} onChange={(v) => setStyle("fill", v)} />
          {d.type === "shape" && (
            <>
              <ColorField id={`${p}-stroke`} label="Stroke" value={object.style.stroke} onChange={(v) => setStyle("stroke", v)} />
              <NumberField id={`${p}-sw`} label="Stroke width" value={object.style.strokeWidth} min={0} max={64} onChange={(v) => setStyle("strokeWidth", v)} />
            </>
          )}
          {d.type === "text" && (
            <div className="grid grid-cols-2 gap-2">
              <NumberField id={`${p}-fs`} label="Font size" value={object.style.fontSize ?? 48} min={6} max={512} onChange={(v) => setStyle("fontSize", v)} />
              <NumberField id={`${p}-fw`} label="Weight" value={object.style.fontWeight ?? 400} step={100} min={100} max={900} onChange={(v) => setStyle("fontWeight", v)} />
            </div>
          )}
        </fieldset>
      )}
    </div>
  );
}
