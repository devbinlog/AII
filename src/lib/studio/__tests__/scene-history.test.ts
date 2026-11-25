import { describe, it, expect } from "vitest";
import { COALESCE_MS, HISTORY_LIMIT, historyReducer, type History } from "../scene-history";
import type { SceneSchema } from "@/types";

const base: SceneSchema = {
  version: "1.0.0",
  sceneId: "scn_h",
  objects: [],
  interactions: [],
  canvasWidth: 1920,
  canvasHeight: 1080,
  backgroundColor: "#0a0a0a",
  audioTrackId: null,
  duration: null,
};
const start: History = { past: [], present: base, future: [], lastKey: null, lastAt: 0 };
const bg = (c: string) => (s: SceneSchema) => ({ ...s, backgroundColor: c });

describe("scene history", () => {
  it("each un-keyed edit is its own undo step; undo/redo walk them exactly", () => {
    let h = historyReducer(start, { type: "edit", fn: bg("#111111"), key: null, at: 1 });
    h = historyReducer(h, { type: "edit", fn: bg("#222222"), key: null, at: 2 });
    expect(h.past.map((s) => s.backgroundColor)).toEqual(["#0a0a0a", "#111111"]);
    h = historyReducer(h, { type: "undo" });
    expect(h.present.backgroundColor).toBe("#111111");
    h = historyReducer(h, { type: "redo" });
    expect(h.present.backgroundColor).toBe("#222222");
    expect(h.future).toEqual([]);
  });

  it("a new edit after undo clears the redo stack", () => {
    let h = historyReducer(start, { type: "edit", fn: bg("#111111"), key: null, at: 1 });
    h = historyReducer(h, { type: "undo" });
    expect(h.future).toHaveLength(1);
    h = historyReducer(h, { type: "edit", fn: bg("#333333"), key: null, at: 5 });
    expect(h.future).toEqual([]);
    expect(historyReducer(h, { type: "redo" })).toBe(h);
  });

  it("edits sharing a key inside the window coalesce (nudges, typing); outside it they do not", () => {
    let h = historyReducer(start, { type: "edit", fn: bg("#111111"), key: "nudge:a", at: 1000 });
    h = historyReducer(h, { type: "edit", fn: bg("#222222"), key: "nudge:a", at: 1000 + COALESCE_MS - 1 });
    expect(h.past).toHaveLength(1);
    h = historyReducer(h, { type: "edit", fn: bg("#333333"), key: "nudge:a", at: 1000 + 3 * COALESCE_MS });
    expect(h.past).toHaveLength(2);
    h = historyReducer(h, { type: "edit", fn: bg("#444444"), key: "nudge:b", at: 1000 + 3 * COALESCE_MS + 1 });
    expect(h.past).toHaveLength(3);
  });

  it("undo breaks coalescing so the next keyed edit starts a new step", () => {
    let h = historyReducer(start, { type: "edit", fn: bg("#111111"), key: "k", at: 1 });
    h = historyReducer(h, { type: "undo" });
    h = historyReducer(h, { type: "edit", fn: bg("#222222"), key: "k", at: 2 });
    expect(h.past.map((s) => s.backgroundColor)).toEqual(["#0a0a0a"]);
  });

  it("an edit that returns the same object records nothing (selection never touches history)", () => {
    expect(historyReducer(start, { type: "edit", fn: (s) => s, key: null, at: 1 })).toBe(start);
  });

  it("undo/redo on empty stacks are no-ops, and history is bounded", () => {
    expect(historyReducer(start, { type: "undo" })).toBe(start);
    expect(historyReducer(start, { type: "redo" })).toBe(start);
    let h = start;
    for (let i = 0; i < HISTORY_LIMIT + 25; i++) h = historyReducer(h, { type: "edit", fn: bg(`#${String(i).padStart(6, "0")}`), key: null, at: i });
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });
});
