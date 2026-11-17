import { describe, it, expect } from "vitest";
import {
  CAMERA_VIEWS,
  STAGE_BOUNDS,
  STAGE_CENTER,
  clampTarget,
  clampToStage,
  defaultStageLayout,
  historyReducer,
  initHistory,
  isInsideStage,
  isMovable,
  moveItem,
  normalizeStageLayout,
  nudgeItem,
  performerRole,
  ROLE_STYLES,
  parseStageLayout,
  rotateItem,
  validateAgainstReference,
} from "..";

const layout = defaultStageLayout("art_001", "2026-11-17T00:00:00Z");
const find = (l: typeof layout, id: string) => l.items.find((i) => i.id === id)!;

describe("default layout", () => {
  it("is valid, inside the stage, with amps and drums locked", () => {
    expect(parseStageLayout(layout).ok).toBe(true);
    for (const item of layout.items) expect(isInsideStage(item)).toBe(true);
    for (const item of layout.items.filter((i) => i.kind === "amplifier" || i.kind === "drums")) {
      expect(item.locked).toBe(true);
      expect(isMovable(item)).toBe(false);
    }
    expect(layout.items.filter((i) => i.kind === "performer")).toHaveLength(5);
  });
});

describe("character system", () => {
  it("every default performer maps to a distinct role with a distinct color and base pattern", () => {
    const roles = layout.items.map(performerRole).filter((r) => r !== null);
    expect(new Set(roles)).toEqual(new Set(["vocal", "guitar", "bass", "drums", "keys"]));
    const styles = Object.values(ROLE_STYLES);
    expect(new Set(styles.map((s) => s.color)).size).toBe(5);
    expect(new Set(styles.map((s) => s.base)).size).toBe(5);
    expect(performerRole(find(layout, "drums"))).toBeNull();
    expect(performerRole({ id: "x", kind: "performer", label: "Synth" })).toBe("keys");
  });
});

describe("additive migration", () => {
  it("adds items introduced later without touching saved coordinates", () => {
    const saved = moveItem({ ...layout, items: layout.items.filter((i) => i.id !== "member-keys") }, "member-vocal", [1, 0, 1]);
    const normalized = normalizeStageLayout(saved, layout);
    expect(normalized.items.map((i) => i.id)).toContain("member-keys");
    expect(find(normalized, "member-vocal").position).toEqual([1, 0, 1]);
    expect(validateAgainstReference(normalized, layout)).toEqual([]);
    expect(normalizeStageLayout(layout, layout)).toBe(layout);
  });
});

describe("movement", () => {
  it("moves performers and instruments", () => {
    const next = moveItem(layout, "member-vocal", [1, 0, 2]);
    expect(find(next, "member-vocal").position).toEqual([1, 0, 2]);
    expect(find(moveItem(layout, "guitar", [-1, 0, 0]), "guitar").position).toEqual([-1, 0, 0]);
  });

  it("refuses to move amps and drums (returns the same layout)", () => {
    expect(moveItem(layout, "drums", [2, 0, 2])).toBe(layout);
    expect(moveItem(layout, "amp-bass", [0, 0, 0])).toBe(layout);
    expect(rotateItem(layout, "amp-guitar", 1)).toBe(layout);
    // Even if someone flips the flag, the kind stays locked
    const unlocked = { ...layout, items: layout.items.map((i) => (i.id === "drums" ? { ...i, locked: false } : i)) };
    expect(moveItem(unlocked, "drums", [2, 0, 2])).toBe(unlocked);
  });

  it("clamps to the stage edge including the footprint", () => {
    const next = moveItem(layout, "member-vocal", [100, 5, -100]);
    const p = find(next, "member-vocal").position;
    expect(p[0]).toBeCloseTo(STAGE_BOUNDS.halfWidth - 0.35);
    expect(p[1]).toBe(0);
    expect(p[2]).toBeCloseTo(-(STAGE_BOUNDS.halfDepth - 0.35));
    expect(isInsideStage(find(next, "member-vocal"))).toBe(true);
    expect(clampToStage("keyboard", [-10, 0, 0])[0]).toBeCloseTo(-(STAGE_BOUNDS.halfWidth - 0.7));
  });

  it("snaps to the grid when asked and nudges by small steps", () => {
    expect(find(moveItem(layout, "mic-vocal", [0.37, 0, 1.12], { snap: true }), "mic-vocal").position).toEqual([0.25, 0, 1]);
    expect(find(nudgeItem(layout, "bass", 0.25, 0), "bass").position).toEqual([2.75, 0, 1]);
  });

  it("rotation wraps into [0, 2π)", () => {
    const r = find(rotateItem(layout, "member-bass", -Math.PI), "member-bass").rotationY;
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(Math.PI * 2);
  });
});

describe("server validation against the reference layout", () => {
  it("accepts legal moves", () => {
    expect(validateAgainstReference(moveItem(layout, "member-guitar", [-3, 0, 1]), layout)).toEqual([]);
  });

  it("rejects moved/unlocked locked items, out-of-bounds, unknown and missing items", () => {
    const tampered = {
      ...layout,
      items: layout.items
        .filter((i) => i.id !== "keyboard")
        .map((i) => (i.id === "drums" ? { ...i, position: [3, 0, 0] as [number, number, number] } : i.id === "amp-bass" ? { ...i, locked: false } : i.id === "member-vocal" ? { ...i, position: [50, 0, 0] as [number, number, number] } : i))
        .concat({ id: "operator", kind: "performer", label: "Operator", position: [0, 0, 3], rotationY: 0, locked: false }),
    };
    const problems = validateAgainstReference(tampered, layout).join(" | ");
    expect(problems).toMatch(/drums: locked item cannot move/);
    expect(problems).toMatch(/amp-bass: cannot be unlocked/);
    expect(problems).toMatch(/member-vocal: outside the stage/);
    expect(problems).toMatch(/unknown item operator/);
    expect(problems).toMatch(/missing item keyboard/);
  });
});

describe("history", () => {
  it("undo/redo and drag commit produce one step", () => {
    let h = initHistory(layout);
    const a = moveItem(layout, "guitar", [-2, 0, 0]);
    h = historyReducer(h, { type: "set", value: a });
    // drag: many replaces, one commit
    const start = h.present;
    for (const x of [-1.8, -1.5, -1.2]) h = historyReducer(h, { type: "replace", value: moveItem(h.present, "guitar", [x, 0, 0]) });
    h = historyReducer(h, { type: "commit", from: start });
    expect(h.past).toHaveLength(2);
    h = historyReducer(h, { type: "undo" });
    expect(find(h.present, "guitar").position).toEqual([-2, 0, 0]);
    h = historyReducer(h, { type: "undo" });
    expect(h.present).toBe(layout);
    h = historyReducer(h, { type: "redo" });
    expect(find(h.present, "guitar").position).toEqual([-2, 0, 0]);
  });
});

describe("camera", () => {
  it("every view targets the stage area; perspective targets stage center", () => {
    expect(CAMERA_VIEWS.perspective.target).toEqual(STAGE_CENTER);
    expect(CAMERA_VIEWS.top.position[1]).toBeGreaterThan(10);
    expect(CAMERA_VIEWS.front.position[2]).toBeGreaterThan(10);
    expect(CAMERA_VIEWS.side.position[0]).toBeGreaterThan(10);
  });

  it("pan target is kept near the stage", () => {
    const t = clampTarget([30, 10, 40]);
    expect(Math.hypot(t[0], t[2])).toBeCloseTo(8);
    expect(t[1]).toBe(4);
  });
});
