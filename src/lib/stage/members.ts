// Multi-member lineups: performers added beyond the five built-in members.
//
// Identity model
//   • Stage object id (`perf-…`, `inst-…`): what is rendered, selected and dragged.
//   • Member id (`mbr-…`): which performer it is — carried by the performer item and by
//     the instrument it plays. Independent of the object id, never derived from the role.
//   • Role: vocal / guitar / bass / keys / drums. Several members may share a role.
//   A stage member is a performer in the lineup, not an account or artist membership.
//
// The five built-in members (member-vocal …) keep their fixed ids, roles and backline
// rules; legacy layouts contain only those and load unchanged.

import { ROLE_STYLES, performerRole, type PerformerRole } from "./characters";
import { defaultStageLayout } from "./presets";
import { backlineOverlap, clampToStage } from "./layout";
import type { StageItem, StageItemKind, StageLayout, Vec3 } from "./types";

/** Instrument that travels with a member of each role (drummers share the fixed kit). */
export const MEMBER_INSTRUMENT_KIND: Record<PerformerRole, Exclude<StageItemKind, "performer" | "amplifier" | "drums"> | null> = {
  vocal: "mic",
  guitar: "guitar",
  bass: "bass",
  keys: "keyboard",
  drums: null,
};

const INSTRUMENT_LABEL: Record<Exclude<StageItemKind, "performer" | "amplifier" | "drums">, string> = {
  mic: "Mic",
  guitar: "Guitar",
  bass: "Bass",
  keyboard: "Keyboard",
};

/** Built-in member item per role, used for default spawn points. */
const BUILT_IN_MEMBER: Record<PerformerRole, string> = {
  vocal: "member-vocal",
  guitar: "member-guitar",
  bass: "member-bass",
  keys: "member-keys",
  drums: "member-drums",
};
const BUILT_IN_INSTRUMENT: Partial<Record<PerformerRole, string>> = { vocal: "mic-vocal", guitar: "guitar", bass: "bass", keys: "keyboard" };

export const MAX_ADDED_MEMBERS = 10;
export const MEMBER_ID = /^mbr-[a-z0-9]{6,32}$/;
export const ADDED_OBJECT_ID = /^(perf|inst)-[a-z0-9]{6,32}$/;
export const NAME_MAX = 40;

export interface NewMemberIds {
  memberId: string;
  performerId: string;
  instrumentId: string;
}

/** Fresh, unrelated ids for a member, its stage object and its instrument. */
export function newMemberIds(random: () => string = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16)): NewMemberIds {
  return { memberId: `mbr-${random()}`, performerId: `perf-${random()}`, instrumentId: `inst-${random()}` };
}

export function isAddedMember(item: StageItem): boolean {
  return item.kind === "performer" && item.memberId !== undefined;
}

export function addedMembers(layout: Pick<StageLayout, "items">): StageItem[] {
  return layout.items.filter(isAddedMember);
}

/** The instrument linked to an added member (by member id), if any. */
export function instrumentOf(layout: Pick<StageLayout, "items">, memberId: string): StageItem | null {
  return layout.items.find((i) => i.kind !== "performer" && i.memberId === memberId) ?? null;
}

/** The performer that plays an added instrument, if any. */
export function playerOf(layout: Pick<StageLayout, "items">, instrument: StageItem): StageItem | null {
  if (instrument.kind === "performer" || !instrument.memberId) return null;
  return layout.items.find((i) => i.kind === "performer" && i.memberId === instrument.memberId) ?? null;
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** A free floor spot near `base`: inside the stage, clear of amps, not on top of another performer. */
function freeSpot(layout: StageLayout, kind: StageItemKind, base: Vec3): Vec3 {
  const probe: StageItem = { id: "__probe__", kind, label: "probe", position: base, rotationY: 0, locked: false };
  const offsets: [number, number][] = [[0, 0], [0.75, 0], [-0.75, 0], [0, 0.75], [1.5, 0], [-1.5, 0], [0.75, 0.75], [-0.75, 0.75], [2.25, 0], [-2.25, 0], [0, 1.5]];
  const others = layout.items.filter((i) => i.kind === "performer").map((i) => i.position);
  for (const [dx, dz] of offsets) {
    const p = clampToStage(kind, [base[0] + dx, 0, base[2] + dz]);
    if (backlineOverlap(layout, probe, p) > 0) continue;
    if (kind === "performer" && others.some((o) => dist(o, p) < 0.7)) continue;
    return p;
  }
  return clampToStage(kind, base);
}

function instrumentItem(layout: StageLayout, role: PerformerRole, performer: StageItem, id: string, memberId: string): StageItem | null {
  const kind = MEMBER_INSTRUMENT_KIND[role];
  if (!kind) return null;
  const ref = defaultStageLayout(layout.artistId).items;
  const refMember = ref.find((i) => i.id === BUILT_IN_MEMBER[role])!;
  const refInst = ref.find((i) => i.id === BUILT_IN_INSTRUMENT[role])!;
  const offset: Vec3 = [refInst.position[0] - refMember.position[0], 0, refInst.position[2] - refMember.position[2]];
  const position = freeSpot(layout, kind, [performer.position[0] + offset[0], 0, performer.position[2] + offset[2]]);
  return { id, kind, label: `${INSTRUMENT_LABEL[kind]} · ${performer.label}`.slice(0, NAME_MAX), position, rotationY: performer.rotationY, locked: false, memberId };
}

/**
 * Add a member of `role` (several members may share a role). The performer spawns near
 * the role's default spot, its instrument (if the role has one) next to it. Returns the
 * layout unchanged when the member limit is reached or an id is already taken.
 */
export function addMember(layout: StageLayout, role: PerformerRole, ids: NewMemberIds, name?: string): StageLayout {
  if (addedMembers(layout).length >= MAX_ADDED_MEMBERS) return layout;
  const taken = new Set(layout.items.map((i) => i.id));
  if (taken.has(ids.performerId) || taken.has(ids.instrumentId) || layout.items.some((i) => i.memberId === ids.memberId)) return layout;
  const ref = defaultStageLayout(layout.artistId).items.find((i) => i.id === BUILT_IN_MEMBER[role])!;
  const sameRole = layout.items.filter((i) => performerRole(i) === role).length;
  const label = (name?.trim() || `${ROLE_STYLES[role].label} ${sameRole + 1}`).slice(0, NAME_MAX);
  const performer: StageItem = {
    id: ids.performerId,
    kind: "performer",
    label,
    position: freeSpot(layout, "performer", ref.position),
    rotationY: ref.rotationY,
    locked: false,
    memberId: ids.memberId,
    role,
  };
  const withPerformer = { ...layout, items: [...layout.items, performer] };
  const instrument = instrumentItem(withPerformer, role, performer, ids.instrumentId, ids.memberId);
  return instrument ? { ...withPerformer, items: [...withPerformer.items, instrument] } : withPerformer;
}

/** Take an added member (and their instrument) off the stage. Built-in members use the lineup picker. */
export function removeMember(layout: StageLayout, memberId: string): StageLayout {
  const items = layout.items.filter((i) => i.memberId !== memberId);
  if (items.length === layout.items.length) return layout;
  if (!items.some((i) => i.kind === "performer")) return layout; // keep at least one member on stage
  return { ...layout, items };
}

/** Rename any performer (display label). An added member's instrument label follows. */
export function renameMember(layout: StageLayout, performerId: string, name: string): StageLayout {
  const label = name.trim().slice(0, NAME_MAX);
  const target = layout.items.find((i) => i.id === performerId && i.kind === "performer");
  if (!target || label.length === 0 || label === target.label) return layout;
  return {
    ...layout,
    items: layout.items.map((i) => {
      if (i.id === performerId) return { ...i, label };
      if (target.memberId && i.kind !== "performer" && i.memberId === target.memberId) {
        return { ...i, label: `${INSTRUMENT_LABEL[i.kind as keyof typeof INSTRUMENT_LABEL] ?? i.label} · ${label}`.slice(0, NAME_MAX) };
      }
      return i;
    }),
  };
}

/** Change an added member's role; their instrument is swapped for the new role's instrument. */
export function setMemberRole(layout: StageLayout, memberId: string, role: PerformerRole, newInstrumentId: string): StageLayout {
  const performer = layout.items.find((i) => i.kind === "performer" && i.memberId === memberId);
  if (!performer || performer.role === role) return layout;
  const old = instrumentOf(layout, memberId);
  const keepId = old && MEMBER_INSTRUMENT_KIND[role] === old.kind;
  if (keepId) return { ...layout, items: layout.items.map((i) => (i.id === performer.id ? { ...i, role } : i)) };
  const updated: StageItem = { ...performer, role };
  const base = { ...layout, items: layout.items.filter((i) => i.id !== old?.id).map((i) => (i.id === performer.id ? updated : i)) };
  if (base.items.some((i) => i.id === newInstrumentId)) return layout;
  const instrument = instrumentItem(base, role, updated, newInstrumentId, memberId);
  return instrument ? { ...base, items: [...base.items, instrument] } : base;
}

/**
 * Server-side checks for added members and instruments (items outside the built-in set).
 * Returns problems (empty = valid). Built-in items are validated by validateAgainstReference.
 */
export function validateAddedMembers(items: readonly StageItem[], builtInIds: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const performers = new Map<string, StageItem>();
  const instruments: StageItem[] = [];
  for (const item of items) {
    if (builtInIds.has(item.id)) {
      if (item.memberId !== undefined || item.role !== undefined) problems.push(`${item.id}: built-in items cannot carry a member id or role`);
      continue;
    }
    if (!ADDED_OBJECT_ID.test(item.id)) {
      problems.push(`unknown item ${item.id}`);
      continue;
    }
    if (!item.memberId || !MEMBER_ID.test(item.memberId)) {
      problems.push(`${item.id}: added items need a valid member id`);
      continue;
    }
    if (item.locked) problems.push(`${item.id}: added items cannot be locked`);
    if (item.kind === "performer") {
      if (!item.id.startsWith("perf-")) problems.push(`${item.id}: performer ids start with perf-`);
      if (!item.role) problems.push(`${item.id}: added performers need a role`);
      if (performers.has(item.memberId)) problems.push(`${item.id}: member ${item.memberId} appears twice`);
      performers.set(item.memberId, item);
    } else if (item.kind === "amplifier" || item.kind === "drums") {
      problems.push(`${item.id}: backline cannot be added`);
    } else {
      if (!item.id.startsWith("inst-")) problems.push(`${item.id}: instrument ids start with inst-`);
      if (item.role !== undefined) problems.push(`${item.id}: instruments have no role`);
      instruments.push(item);
    }
  }
  if (performers.size > MAX_ADDED_MEMBERS) problems.push(`at most ${MAX_ADDED_MEMBERS} added members`);
  const owned = new Set<string>();
  for (const inst of instruments) {
    const player = performers.get(inst.memberId!);
    if (!player) {
      problems.push(`${inst.id}: no member ${inst.memberId} on stage`);
      continue;
    }
    if (owned.has(inst.memberId!)) problems.push(`${inst.id}: member ${inst.memberId} already has an instrument`);
    owned.add(inst.memberId!);
    if (player.role && MEMBER_INSTRUMENT_KIND[player.role] !== inst.kind) problems.push(`${inst.id}: a ${player.role} member cannot play ${inst.kind}`);
  }
  return problems;
}
