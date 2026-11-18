import { describe, it, expect } from "vitest";
import {
  CAMERA_VIEWS,
  CURRENT_BACKLINE,
  backlineOf,
  referenceFor,
  upgradeBackline,
  STAGE_BOUNDS,
  STAGE_CENTER,
  clampTarget,
  clampToStage,
  defaultStageLayout,
  historyReducer,
  initHistory,
  isInsideStage,
  isMovable,
  backlineOverlap,
  moveItem,
  serializeStageLayout,
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

describe("default layout — audience-facing sides", () => {
  // Derive "audience right" from the camera instead of assuming a sign for X:
  // right = forward × up, for every view the audience actually looks from.
  const audienceRight = (view: "perspective" | "front") => {
    const { position: p, target: t } = CAMERA_VIEWS[view];
    const fx = t[0] - p[0];
    const fz = t[2] - p[2];
    return [-fz, 0, fx] as const; // forward × up(0,1,0)
  };
  const side = (id: string, view: "perspective" | "front") => {
    const r = audienceRight(view);
    const dot = find(layout, id).position[0] * r[0] + find(layout, id).position[2] * r[2];
    return dot > 0 ? "right" : dot < 0 ? "left" : "center";
  };

  it.each(["perspective", "front"] as const)("from the %s view: bass left, guitar and keys right, vocal center", (view) => {
    expect(side("member-bass", view)).toBe("left");
    expect(side("bass", view)).toBe("left");
    expect(side("member-guitar", view)).toBe("right");
    expect(side("guitar", view)).toBe("right");
    expect(side("member-keys", view)).toBe("right");
    expect(side("keyboard", view)).toBe("right");
    expect(find(layout, "member-vocal").position[0]).toBe(0);
    expect(find(layout, "mic-vocal").position[0]).toBe(0);
  });

  it("puts each amp on its player's side; drums stay center", () => {
    expect(find(layout, "drums").position).toEqual([0, 0, -2.5]);
    expect(side("amp-bass", "front")).toBe("left");
    expect(side("amp-guitar", "front")).toBe("right");
    expect(side("amp-keys", "front")).toBe("right");
    const dist = (a: string, b: string) =>
      Math.hypot(find(layout, a).position[0] - find(layout, b).position[0], find(layout, a).position[2] - find(layout, b).position[2]);
    const amps = ["amp-bass", "amp-guitar", "amp-keys"];
    for (const [amp, player] of [["amp-bass", "member-bass"], ["amp-guitar", "member-guitar"], ["amp-keys", "member-keys"]] as const) {
      for (const other of amps.filter((a) => a !== amp)) expect(dist(amp, player)).toBeLessThan(dist(other, player));
    }
  });

  it("has no item inside backline gear", () => {
    for (const item of layout.items) expect(backlineOverlap(layout, item, item.position)).toBe(0);
  });

  it("round-trips through save/load with identical coordinates", () => {
    const loaded = parseStageLayout(JSON.parse(serializeStageLayout(layout)));
    expect(loaded.ok && loaded.layout.items).toEqual(layout.items);
  });

  it("does not rewrite a saved draft that still has the old arrangement", () => {
    const oldDraft = { ...layout, items: layout.items.map((i) => (i.id === "member-bass" ? { ...i, position: [2.5, 0, 0.5] as [number, number, number] } : i)) };
    const normalized = normalizeStageLayout(oldDraft, layout);
    expect(find(normalized, "member-bass").position).toEqual([2.5, 0, 0.5]);
    expect(validateAgainstReference(normalized, layout)).toEqual([]);
  });
});

describe("backline versions (compatibility policy)", () => {
  const P = (x: number, z: number) => [x, 0, z] as [number, number, number];
  /** A draft saved before backlines were versioned: no field, original amp positions, a moved vocal. */
  const legacyDraft = () => {
    const l = defaultStageLayout("art_001", "2026-11-01T00:00:00Z", 1);
    const { backlineVersion: _drop, ...unversioned } = l;
    void _drop;
    return { ...unversioned, items: l.items.map((i) => (i.id === "member-vocal" ? { ...i, position: P(1.25, 2) } : i)) };
  };

  it("new layouts use the current backline", () => {
    expect(layout.backlineVersion).toBe(CURRENT_BACKLINE);
    expect(backlineOf(layout)).toBe(CURRENT_BACKLINE);
  });

  it("an unversioned draft resolves by where its amps are", () => {
    expect(backlineOf(legacyDraft())).toBe(1);
    const { backlineVersion: _v, ...unversionedCurrent } = layout;
    void _v;
    expect(backlineOf(unversionedCurrent)).toBe(2);
  });

  it("a legacy draft validates against its own backline, unchanged", () => {
    const d = legacyDraft();
    expect(validateAgainstReference(normalizeStageLayout(d, referenceFor(d, "art_001")), referenceFor(d, "art_001"))).toEqual([]);
    expect(normalizeStageLayout(d, referenceFor(d, "art_001"))).toBe(d); // nothing to add, same object
  });

  it("parse/serialize round-trip is lossless and does not invent a backlineVersion", () => {
    const d = legacyDraft();
    const back = parseStageLayout(JSON.parse(serializeStageLayout(d)));
    expect(back.ok && back.layout).toEqual(d);
    expect(back.ok && "backlineVersion" in back.layout).toBe(false);
  });

  it("upgradeBackline moves only locked gear and marks the current version", () => {
    const up = upgradeBackline(legacyDraft());
    expect(up.backlineVersion).toBe(CURRENT_BACKLINE);
    expect(find(up, "amp-bass").position).toEqual([-3.5, 0, -2.75]);
    for (const i of up.items.filter((x) => isMovable(x))) expect(i).toEqual(find(legacyDraft(), i.id));
    expect(validateAgainstReference(up, referenceFor(up, "art_001"))).toEqual([]);
  });

  it("a current-backline layout with an amp on the old side is invalid", () => {
    const bad = { ...layout, items: layout.items.map((i) => (i.id === "amp-bass" ? { ...i, position: P(3.5, -2.75) } : i)) };
    expect(validateAgainstReference(bad, referenceFor(bad, "art_001")).join()).toMatch(/locked item cannot move/);
  });
});

describe("backline collision guard", () => {
  it("rejects moving an instrument into an amp", () => {
    const amp = find(layout, "amp-bass").position;
    expect(find(moveItem(layout, "guitar", [amp[0], 0, amp[2] + 0.4]), "guitar").position).toEqual(find(layout, "guitar").position);
  });
  it("rejects moving an instrument into the drum kit, but lets performers reach it", () => {
    expect(find(moveItem(layout, "bass", [0.5, 0, -2]), "bass").position).toEqual(find(layout, "bass").position);
    expect(find(moveItem(layout, "member-vocal", [0, 0, -1.5]), "member-vocal").position).toEqual([0, 0, -1.5]);
  });
  it("lets an item that already overlaps move out", () => {
    const stuck = { ...layout, items: layout.items.map((i) => (i.id === "guitar" ? { ...i, position: [3.5, 0, -2.25] as [number, number, number] } : i)) };
    expect(find(moveItem(stuck, "guitar", [3.5, 0, -1]), "guitar").position).toEqual([3.5, 0, -1]);
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
    expect(find(nudgeItem(layout, "bass", 0.25, 0), "bass").position).toEqual([-2.25, 0, 1]);
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
