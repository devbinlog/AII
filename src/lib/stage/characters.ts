// Hologram character system — one visual language, five session roles.
// Pure data (no three.js) so the editor, viewer and tests share it.

import type { StageItem } from "./types";

export type PerformerRole = "vocal" | "guitar" | "bass" | "drums" | "keys";

export interface RoleStyle {
  label: string;
  /** Body / emissive hue (from the Stage palette) */
  color: string;
  /** Secondary accent for instrument details */
  accent: string;
  /** Projector-base pattern, so roles differ even in plan (top) view */
  base: "pulse" | "ticks" | "double" | "hex" | "square";
  /** Overall height factor (stage-scale; 1 = 1.8 m) */
  scale: number;
}

// Stage palette: Cyan #38D9F2 · Electric Blue #367CFA · Spectral Violet #A3A0FF · Amber #F5BC73.
// Keys uses Periwinkle #7FA3FF, a derived midpoint of Blue and Violet.
export const ROLE_STYLES: Record<PerformerRole, RoleStyle> = {
  vocal: { label: "Vocal", color: "#38d9f2", accent: "#f2efe8", base: "pulse", scale: 1 },
  guitar: { label: "Guitar", color: "#367cfa", accent: "#38d9f2", base: "ticks", scale: 1 },
  bass: { label: "Bass", color: "#a3a0ff", accent: "#367cfa", base: "double", scale: 1.06 },
  drums: { label: "Drums", color: "#f5bc73", accent: "#38d9f2", base: "hex", scale: 1 },
  keys: { label: "Keys", color: "#7fa3ff", accent: "#a3a0ff", base: "square", scale: 1 },
};

/** Lineup order in the picker. */
export const PERFORMER_ROLES: readonly PerformerRole[] = ["vocal", "guitar", "bass", "keys", "drums"];

/**
 * Items that join or leave the stage together with each role. The drum kit and the
 * amps are fixed backline and stay even when their player is benched.
 */
export const ROLE_ITEMS: Record<PerformerRole, readonly string[]> = {
  vocal: ["member-vocal", "mic-vocal"],
  guitar: ["member-guitar", "guitar"],
  bass: ["member-bass", "bass"],
  keys: ["member-keys", "keyboard"],
  drums: ["member-drums"],
};

/** Instrument shown on each role's lineup card. */
export const ROLE_INSTRUMENT: Record<PerformerRole, string> = {
  vocal: "Vocal mic",
  guitar: "Electric guitar",
  bass: "Bass guitar",
  keys: "Keyboard",
  drums: "Drum kit",
};

/** Item ids removed from the stage by a set of benched roles. */
export function benchedItemIds(benched: readonly PerformerRole[] | undefined): Set<string> {
  return new Set((benched ?? []).flatMap((r) => ROLE_ITEMS[r]));
}

const ROLE_BY_ID: Record<string, PerformerRole> = {
  "member-vocal": "vocal",
  "member-guitar": "guitar",
  "member-bass": "bass",
  "member-drums": "drums",
  "member-keys": "keys",
};

/** Role of a performer item (by stable id, then by label). Non-performers return null. */
export function performerRole(item: Pick<StageItem, "id" | "kind" | "label">): PerformerRole | null {
  if (item.kind !== "performer") return null;
  const byId = ROLE_BY_ID[item.id];
  if (byId) return byId;
  const l = item.label.toLowerCase();
  if (l.includes("vocal") || l.includes("voice")) return "vocal";
  if (l.includes("bass")) return "bass";
  if (l.includes("guitar")) return "guitar";
  if (l.includes("drum") || l.includes("perc")) return "drums";
  if (l.includes("key") || l.includes("synth") || l.includes("piano")) return "keys";
  return "vocal";
}
