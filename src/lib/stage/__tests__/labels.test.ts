import { describe, it, expect } from "vitest";
import { placeLabels, type LabelInput } from "../labels";

const vp = { width: 800, height: 450 };
const label = (id: string, x: number, y: number, depth: number, selected = false): LabelInput => ({ id, x, y, depth, width: 60, height: 18, selected });
const rect = (p: { x: number; y: number }) => ({ l: p.x - 30, r: p.x + 30, t: p.y - 9, b: p.y + 9 });
const overlap = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

describe("placeLabels", () => {
  it("leaves separated labels at their anchors", () => {
    const out = placeLabels([label("a", 100, 100, 0.5), label("b", 400, 100, 0.6)], vp);
    expect(out.map((p) => [p.state, p.x, p.y])).toEqual([["anchor", 100, 100], ["anchor", 400, 100]]);
  });

  it("separates labels of members standing one behind another; the nearer one keeps its anchor", () => {
    const out = placeLabels([label("far", 400, 200, 0.9), label("near", 400, 202, 0.7)], vp);
    const near = out.find((p) => p.id === "near")!;
    const far = out.find((p) => p.id === "far")!;
    expect(near.state).toBe("anchor");
    expect(far.state).toBe("shifted");
    expect(overlap(rect(near), rect(far))).toBe(false);
  });

  it("gives the selected label priority even when it is farther away", () => {
    const out = placeLabels([label("near", 400, 200, 0.5), label("sel", 400, 200, 0.9, true)], vp);
    expect(out.find((p) => p.id === "sel")!.state).toBe("anchor");
    expect(out.find((p) => p.id === "near")!.state).toBe("shifted");
  });

  it("hides labels with no free slot but never the selected one", () => {
    const crowd = Array.from({ length: 12 }, (_, i) => label(`m${i}`, 400, 200, 0.5 + i * 0.01));
    const out = placeLabels([...crowd, label("sel", 400, 200, 0.99, true)], vp);
    expect(out.find((p) => p.id === "sel")!.state).toBe("anchor");
    expect(out.some((p) => p.state === "hidden")).toBe(true);
    const shown = out.filter((p) => p.state !== "hidden");
    for (const a of shown) for (const b of shown) if (a !== b) expect(overlap(rect(a), rect(b))).toBe(false);
  });

  it("keeps labels inside a phone-width viewport", () => {
    const out = placeLabels([label("edge", 2, 3, 0.5)], { width: 360, height: 300 });
    expect(out[0]!.x).toBeGreaterThanOrEqual(30);
    expect(out[0]!.y).toBeGreaterThanOrEqual(9);
  });

  it("is deterministic regardless of input order", () => {
    const a = [label("x", 300, 100, 0.6), label("y", 305, 100, 0.6), label("z", 310, 100, 0.6)];
    const byId = (ps: ReturnType<typeof placeLabels>) => Object.fromEntries(ps.map((p) => [p.id, [p.x, p.y, p.state]]));
    expect(byId(placeLabels(a, vp))).toEqual(byId(placeLabels([...a].reverse(), vp)));
  });
});
