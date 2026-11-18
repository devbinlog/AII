// Pure layout operations: bounds, locks, snapping, movement.

import type { StageBounds, StageItem, StageItemKind, StageLayout, Vec3 } from "./types";

export const STAGE_BOUNDS: StageBounds = { halfWidth: 6, halfDepth: 4 };
export const GRID_STEP = 0.25;

/** Footprint radius per kind — keeps the whole object on the stage, not just its center. */
export const FOOTPRINT: Record<StageItemKind, number> = {
  performer: 0.35,
  guitar: 0.3,
  bass: 0.3,
  keyboard: 0.7,
  mic: 0.2,
  amplifier: 0.5,
  drums: 1.1,
};

/** Kinds the configurator never lets anyone move (amps and drum kit). */
export const ALWAYS_LOCKED: ReadonlySet<StageItemKind> = new Set(["amplifier", "drums"]);

export function isMovable(item: StageItem): boolean {
  return !item.locked && !ALWAYS_LOCKED.has(item.kind);
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export function snap(value: number, step = GRID_STEP): number {
  return round(Math.round(value / step) * step);
}

/** Clamp a floor position so the item's footprint stays inside the stage. */
export function clampToStage(kind: StageItemKind, position: Vec3, bounds: StageBounds = STAGE_BOUNDS): Vec3 {
  const r = FOOTPRINT[kind];
  const maxX = bounds.halfWidth - r;
  const maxZ = bounds.halfDepth - r;
  return [round(Math.min(maxX, Math.max(-maxX, position[0]))), 0, round(Math.min(maxZ, Math.max(-maxZ, position[2])))];
}

export function isInsideStage(item: StageItem, bounds: StageBounds = STAGE_BOUNDS): boolean {
  const [x, , z] = clampToStage(item.kind, item.position, bounds);
  return Math.abs(x - item.position[0]) < 1e-6 && Math.abs(z - item.position[2]) < 1e-6 && item.position[1] === 0;
}

/**
 * How far (meters) an item's footprint would sink into fixed backline gear (amps,
 * drum kit) at `position`; 0 = clear. Performers may stand at the drum kit — the
 * drummer sits there — but nothing may sit inside an amp.
 */
export function backlineOverlap(layout: StageLayout, item: StageItem, position: Vec3): number {
  let worst = 0;
  for (const other of layout.items) {
    if (other.id === item.id || !ALWAYS_LOCKED.has(other.kind)) continue;
    if (other.kind === "drums" && item.kind === "performer") continue;
    const gap = Math.hypot(position[0] - other.position[0], position[2] - other.position[2]);
    worst = Math.max(worst, FOOTPRINT[item.kind] + FOOTPRINT[other.kind] - gap);
  }
  return round(worst);
}

/**
 * Move an item to a floor position. Locked items are returned unchanged.
 * The result is clamped to the stage and optionally snapped to the grid; a move
 * that would push the item into an amp or the drum kit is rejected.
 */
export function moveItem(layout: StageLayout, id: string, target: Vec3, options: { snap?: boolean } = {}): StageLayout {
  const item = layout.items.find((i) => i.id === id);
  if (!item || !isMovable(item)) return layout;
  const raw: Vec3 = options.snap ? [snap(target[0]), 0, snap(target[2])] : target;
  const position = clampToStage(item.kind, raw);
  if (position[0] === item.position[0] && position[2] === item.position[2]) return layout;
  // Never push an item deeper into fixed backline gear (an item already overlapping may move out).
  if (backlineOverlap(layout, item, position) > backlineOverlap(layout, item, item.position) + 1e-6) return layout;
  return { ...layout, items: layout.items.map((i) => (i.id === id ? { ...i, position } : i)) };
}

export function nudgeItem(layout: StageLayout, id: string, dx: number, dz: number): StageLayout {
  const item = layout.items.find((i) => i.id === id);
  if (!item) return layout;
  return moveItem(layout, id, [item.position[0] + dx, 0, item.position[2] + dz]);
}

export function rotateItem(layout: StageLayout, id: string, deltaRadians: number): StageLayout {
  const item = layout.items.find((i) => i.id === id);
  if (!item || !isMovable(item)) return layout;
  const full = Math.PI * 2;
  const rotationY = round((((item.rotationY + deltaRadians) % full) + full) % full);
  return { ...layout, items: layout.items.map((i) => (i.id === id ? { ...i, rotationY } : i)) };
}

/**
 * Additive migration: items added to the default layout after a draft was saved
 * (e.g. the Keys member) are inserted at their default positions. Existing items,
 * coordinates and locks are untouched; published versions are never migrated.
 */
export function normalizeStageLayout(layout: StageLayout, reference: StageLayout): StageLayout {
  const have = new Set(layout.items.map((i) => i.id));
  const missing = reference.items.filter((i) => !have.has(i.id));
  return missing.length === 0 ? layout : { ...layout, items: [...layout.items, ...structuredClone(missing)] };
}

/**
 * For layouts READ FROM STORAGE (never for incoming saves): add missing default
 * items, and put platform-locked backline (amps, drum kit) where the current
 * default has it. Artists can never move that gear, so a draft saved before the
 * backline changed would otherwise fail validation on its next save or publish.
 * Members and movable instruments keep exactly the coordinates the artist saved.
 * Published versions are immutable snapshots and are never migrated.
 */
export function migrateStoredLayout(layout: StageLayout, reference: StageLayout): StageLayout {
  const normalized = normalizeStageLayout(layout, reference);
  const refById = new Map(reference.items.map((i) => [i.id, i]));
  let changed = false;
  const items = normalized.items.map((item) => {
    const ref = refById.get(item.id);
    if (!ref || !(ref.locked || ALWAYS_LOCKED.has(ref.kind))) return item;
    const same = item.locked === ref.locked && item.rotationY === ref.rotationY && item.position.every((v, i) => v === ref.position[i]);
    if (same) return item;
    changed = true;
    return { ...item, position: [...ref.position] as Vec3, rotationY: ref.rotationY, locked: ref.locked };
  });
  return changed ? { ...normalized, items } : normalized;
}

/**
 * Server-side guard: locked items must stay exactly where the reference layout
 * has them, every movable item must be inside the stage, and the item set
 * cannot change. Returns human-readable problems (empty = valid).
 */
export function validateAgainstReference(candidate: StageLayout, reference: StageLayout): string[] {
  const problems: string[] = [];
  const refById = new Map(reference.items.map((i) => [i.id, i]));
  const seen = new Set<string>();
  for (const item of candidate.items) {
    if (seen.has(item.id)) problems.push(`duplicate item ${item.id}`);
    seen.add(item.id);
    const ref = refById.get(item.id);
    if (!ref) {
      problems.push(`unknown item ${item.id}`);
      continue;
    }
    if (item.kind !== ref.kind) problems.push(`${item.id}: kind cannot change`);
    const mustStay = ref.locked || ALWAYS_LOCKED.has(ref.kind);
    if (mustStay) {
      if (!item.locked) problems.push(`${item.id}: cannot be unlocked`);
      if (item.position.some((v, i) => Math.abs(v - ref.position[i]!) > 1e-6) || Math.abs(item.rotationY - ref.rotationY) > 1e-6) {
        problems.push(`${item.id}: locked item cannot move`);
      }
    }
    if (!isInsideStage(item)) problems.push(`${item.id}: outside the stage`);
  }
  for (const id of refById.keys()) if (!seen.has(id)) problems.push(`missing item ${id}`);
  return problems;
}
