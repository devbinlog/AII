// Plan-view (top) schematic of a stage layout as plain SVG: no WebGL, server-rendered.
// Drawn from real layout data in the Stage palette. Audience is at the bottom, so
// screen-left is audience-left (-X), matching the 3D Top view.

import { FOOTPRINT, ROLE_STYLES, STAGE_BOUNDS, performerRole, type StageItem } from "@/lib/stage";

const PAD = 0.6;

export function StageSchematic({ items, title, className = "" }: { items: StageItem[]; title: string; className?: string }) {
  const w = STAGE_BOUNDS.halfWidth * 2;
  const d = STAGE_BOUNDS.halfDepth * 2;
  const vb = `${-STAGE_BOUNDS.halfWidth - PAD} ${-STAGE_BOUNDS.halfDepth - PAD} ${w + PAD * 2} ${d + PAD * 2 + 0.9}`;
  const performers = items.filter((i) => i.kind === "performer");
  const gear = items.filter((i) => i.kind !== "performer");
  return (
    <svg viewBox={vb} className={`block w-full h-auto ${className}`} role="img" aria-label={title}>
      <title>{title}</title>
      <rect x={-STAGE_BOUNDS.halfWidth} y={-STAGE_BOUNDS.halfDepth} width={w} height={d} fill="var(--stage-void-2)" stroke="var(--aii-signal)" strokeOpacity="0.7" strokeWidth="0.04" />
      {Array.from({ length: w - 1 }, (_, i) => (
        <line key={`x${i}`} x1={-STAGE_BOUNDS.halfWidth + i + 1} x2={-STAGE_BOUNDS.halfWidth + i + 1} y1={-STAGE_BOUNDS.halfDepth} y2={STAGE_BOUNDS.halfDepth} stroke="#26496c" strokeWidth="0.015" />
      ))}
      {Array.from({ length: d - 1 }, (_, i) => (
        <line key={`z${i}`} y1={-STAGE_BOUNDS.halfDepth + i + 1} y2={-STAGE_BOUNDS.halfDepth + i + 1} x1={-STAGE_BOUNDS.halfWidth} x2={STAGE_BOUNDS.halfWidth} stroke="#26496c" strokeWidth="0.015" />
      ))}
      {gear.map((g) => (
        <g key={g.id} transform={`translate(${g.position[0]} ${g.position[2]})`}>
          {g.kind === "amplifier" || g.kind === "drums" ? (
            <circle r={FOOTPRINT[g.kind]} fill="none" stroke="var(--aii-stone)" strokeOpacity="0.55" strokeWidth="0.04" strokeDasharray="0.12 0.1" />
          ) : (
            <circle r={0.09} fill="var(--aii-stone)" fillOpacity="0.7" />
          )}
        </g>
      ))}
      {performers.map((p) => {
        const role = performerRole(p);
        const color = role ? ROLE_STYLES[role].color : "var(--stage-cyan)";
        return (
          <g key={p.id} transform={`translate(${p.position[0]} ${p.position[2]})`}>
            <circle r={0.42} fill={color} fillOpacity="0.14" />
            <circle r={0.2} fill={color} />
            <text y={-0.55} textAnchor="middle" fontSize="0.3" fontFamily="var(--font-mono)" letterSpacing="0.04" fill="var(--aii-paper)">
              {p.label.toUpperCase()}
            </text>
          </g>
        );
      })}
      <text x={0} y={STAGE_BOUNDS.halfDepth + 0.75} textAnchor="middle" fontSize="0.32" fontFamily="var(--font-mono)" letterSpacing="0.12" fill="var(--aii-stone)">
        AUDIENCE
      </text>
    </svg>
  );
}
