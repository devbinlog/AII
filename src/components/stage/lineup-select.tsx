"use client";

import { PERFORMER_ROLES, ROLE_INSTRUMENT, ROLE_STYLES, type PerformerRole } from "@/lib/stage";

/** Instrument glyph drawn in front of the hologram figure (viewBox 0 0 80 100). */
function Instrument({ role }: { role: PerformerRole }) {
  switch (role) {
    case "vocal":
      return (
        <g>
          <line x1="58" y1="44" x2="58" y2="90" />
          <line x1="50" y1="90" x2="66" y2="90" />
          <rect x="54.5" y="35" width="7" height="10" rx="3.5" />
        </g>
      );
    case "guitar":
      return (
        <g>
          <line x1="30" y1="62" x2="60" y2="38" />
          <path d="M22 60c0-5 6-7 9-5s7 0 8 4-2 9-8 9-9-3-9-8z" />
        </g>
      );
    case "bass":
      return (
        <g>
          <line x1="30" y1="64" x2="66" y2="32" />
          <path d="M20 62c0-6 7-8 10-6s8 0 9 5-2 10-9 10-10-3-10-9z" />
        </g>
      );
    case "keys":
      return (
        <g>
          <rect x="12" y="62" width="56" height="9" />
          {[20, 28, 36, 44, 52, 60].map((x) => (
            <line key={x} x1={x} y1="62" x2={x} y2="71" />
          ))}
          <line x1="20" y1="71" x2="16" y2="90" />
          <line x1="60" y1="71" x2="64" y2="90" />
        </g>
      );
    case "drums":
      return (
        <g>
          <ellipse cx="40" cy="72" rx="15" ry="5" />
          <path d="M25 72v12c0 3 7 5 15 5s15-2 15-5V72" />
          <line x1="64" y1="44" x2="64" y2="90" />
          <ellipse cx="64" cy="44" rx="9" ry="2" />
        </g>
      );
  }
}

function Hologram({ role, on }: { role: PerformerRole; on: boolean }) {
  const { color } = ROLE_STYLES[role];
  return (
    <svg viewBox="0 0 80 100" className="h-full w-auto" aria-hidden="true">
      <ellipse cx="40" cy="92" rx="22" ry="4" fill={color} opacity={on ? 0.25 : 0.08} />
      <g fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={on ? 1 : 0.35} style={on ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined}>
        <circle cx="40" cy="20" r="8" />
        <path d="M28 54l3-20c1-4 4-6 9-6s8 2 9 6l3 20" />
        <path d="M34 54l-2 34M46 54l2 34" />
        <Instrument role={role} />
      </g>
    </svg>
  );
}

/**
 * Lineup picker in the style of a character-select screen: one card per session role.
 * Toggling a card takes that member and their instrument off the stage or brings them
 * back. Amps and the drum kit are fixed backline and are not part of the lineup.
 */
export function LineupSelect({
  benched,
  canEdit,
  onToggle,
}: {
  benched: readonly PerformerRole[];
  canEdit: boolean;
  onToggle: (role: PerformerRole, onStage: boolean) => void;
}) {
  const off = new Set(benched);
  const onCount = PERFORMER_ROLES.length - off.size;
  return (
    <section className="border border-[var(--color-border)] bg-[var(--color-bg-secondary)]" aria-labelledby="lineup-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-border)] px-3 py-2">
        <h2 id="lineup-heading" className="text-xs font-mono font-semibold uppercase tracking-widest text-[var(--color-fg-muted)]">
          Lineup · {onCount}/{PERFORMER_ROLES.length} on stage
        </h2>
        <p className="text-[11px] text-[var(--color-fg-muted)]">
          {canEdit ? "Pick who plays. A member and their instrument join or leave together; amps and drum kit stay." : "Read-only for your role."}
        </p>
      </div>
      <ul className="grid grid-cols-5 gap-px bg-[var(--color-border)]">
        {PERFORMER_ROLES.map((role) => {
          const on = !off.has(role);
          const style = ROLE_STYLES[role];
          const last = on && onCount === 1;
          return (
            <li key={role} className="bg-[var(--color-bg-secondary)]">
              <button
                type="button"
                aria-pressed={on}
                aria-label={`${style.label}: ${on ? "on stage" : "off stage"}`}
                disabled={!canEdit || last}
                title={last ? "At least one member stays on stage" : on ? `Take ${style.label} off stage` : `Bring ${style.label} on stage`}
                onClick={() => onToggle(role, !on)}
                className="group relative flex h-full w-full flex-col items-center gap-1 px-1 pb-2 pt-3 text-center transition-colors enabled:hover:bg-white/[0.04] disabled:cursor-not-allowed"
                style={{ boxShadow: on ? `inset 0 -2px 0 ${style.color}` : undefined }}
              >
                <span className="h-16 sm:h-20">
                  <Hologram role={role} on={on} />
                </span>
                <span className={`text-sm font-semibold ${on ? "text-[var(--color-fg)]" : "text-[var(--color-fg-muted)]"}`}>{style.label}</span>
                <span className="hidden sm:block text-[10px] text-[var(--color-fg-muted)]">{ROLE_INSTRUMENT[role]}</span>
                <span
                  className="mt-0.5 px-1.5 py-px font-mono text-[9px] uppercase tracking-wider border"
                  style={on ? { color: style.color, borderColor: style.color } : { color: "var(--color-fg-muted)", borderColor: "var(--color-border-strong)", borderStyle: "dashed" }}
                >
                  {on ? "On stage" : "Add"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
