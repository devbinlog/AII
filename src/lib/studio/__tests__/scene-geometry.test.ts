import { describe, it, expect } from "vitest";
import { validateSceneSchema } from "@/lib/engine/schema";
import { fitScene } from "@/lib/engine/renderer/viewport";
import { createSceneObject } from "../scene-objects";
import {
  RESIZE_HANDLES,
  containsPoint,
  guideTargets,
  hitTest,
  localBox,
  moveTransform,
  normalizeDegrees,
  nudgeTransform,
  resizeTransform,
  rotateTransform,
  supportsResize,
  worldAabb,
  worldCorners,
  type ResizeHandle,
} from "../scene-geometry";
import type { SceneObject, SceneSchema, SceneTransform } from "@/types";

const NOW = "2026-01-01T00:00:00.000Z";
const scene = { width: 1920, height: 1080 };
const empty: SceneSchema = {
  version: "1.0.0",
  sceneId: "scn_geo",
  objects: [],
  interactions: [],
  canvasWidth: 1920,
  canvasHeight: 1080,
  backgroundColor: "#0a0a0a",
  audioTrackId: null,
  duration: null,
};

function rect(id: string, t: Partial<SceneTransform> = {}, extra: Partial<SceneObject> = {}): SceneObject {
  const o = createSceneObject("rectangle", empty, { id, now: NOW });
  return { ...o, ...extra, transform: { ...o.transform, ...t } };
}

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

describe("fitScene (shared with the Canvas2D renderer)", () => {
  it("letterboxes a 16:9 scene into a taller surface", () => {
    expect(fitScene(960, 720, 1920, 1080)).toEqual({ scale: 0.5, offsetX: 0, offsetY: 90 });
  });
  it("pillarboxes into a wider surface", () => {
    const vp = fitScene(2000, 540, 1920, 1080);
    expect(vp.scale).toBe(0.5);
    expect(vp.offsetX).toBe(520);
    expect(vp.offsetY).toBe(0);
  });
});

describe("localBox", () => {
  it("centres non-text objects on the anchor", () => {
    expect(localBox(rect("a", { width: 400, height: 200 }))).toEqual({ left: -200, top: -100, right: 200, bottom: 100 });
  });
  it("anchors text by textAlign like the renderer (left/center/right, middle baseline)", () => {
    const base = createSceneObject("text", empty, { id: "t", now: NOW });
    const measure = () => 300;
    const fs = base.style.fontSize!;
    expect(localBox({ ...base, style: { ...base.style, textAlign: "left" } }, measure)).toEqual({ left: 0, top: -fs * 0.6, right: 300, bottom: fs * 0.6 });
    expect(localBox({ ...base, style: { ...base.style, textAlign: "center" } }, measure).left).toBe(-150);
    expect(localBox({ ...base, style: { ...base.style, textAlign: "right" } }, measure).right).toBe(0);
    // Renderer default is "center" when textAlign is null
    expect(localBox({ ...base, style: { ...base.style, textAlign: null } }, measure).left).toBe(-150);
  });
  it("only non-text objects get resize handles (text ignores width/height)", () => {
    expect(supportsResize(rect("a"))).toBe(true);
    expect(supportsResize(createSceneObject("text", empty, { now: NOW }))).toBe(false);
  });
});

describe("hitTest", () => {
  it("picks the topmost object: highest z, ties go to the later array entry (renderer paint order)", () => {
    const a = rect("a", { x: 500, y: 500, z: 0 });
    const b = rect("b", { x: 500, y: 500, z: 1 });
    const c = rect("c", { x: 500, y: 500, z: 1 });
    expect(hitTest([a, b, c], 500, 500)).toBe("c");
    expect(hitTest([a, c, b], 500, 500)).toBe("b");
    expect(hitTest([a], 500, 500)).toBe("a");
  });
  it("returns null on empty canvas", () => {
    expect(hitTest([rect("a", { x: 500, y: 500 })], 1500, 900)).toBeNull();
  });
  it("skips hidden and locked objects so what is beneath can be picked", () => {
    const below = rect("below", { x: 500, y: 500, z: 0 });
    const hidden = rect("hidden", { x: 500, y: 500, z: 2 }, { visible: false });
    const locked = rect("locked", { x: 500, y: 500, z: 3 }, { locked: true });
    expect(hitTest([below, hidden, locked], 500, 500)).toBe("below");
  });
  it("respects rotation and scale", () => {
    const r = rect("r", { x: 1000, y: 500, width: 400, height: 20, rotation: 90 });
    expect(hitTest([r], 1000, 680)).toBe("r"); // along the rotated long axis
    expect(hitTest([r], 1180, 500)).toBeNull(); // where the unrotated box would be
    const s = rect("s", { x: 1000, y: 500, width: 100, height: 100, scaleX: 2 });
    expect(hitTest([s], 1090, 500)).toBe("s");
    expect(hitTest([s], 1110, 500)).toBeNull();
  });
  it("tolerance keeps thin objects clickable", () => {
    const line = rect("l", { x: 500, y: 500, width: 300, height: 0 });
    expect(hitTest([line], 500, 503)).toBeNull();
    expect(hitTest([line], 500, 503, { tolerance: 4 })).toBe("l");
  });
});

describe("moveTransform", () => {
  const box = localBox(rect("a", { width: 400, height: 200 }));
  const start = rect("a", { x: 960, y: 540, width: 400, height: 200 }).transform;

  it("moves by the delta, rounded to whole units, without touching other fields", () => {
    const r = moveTransform(start, box, 100.4, -50.6, scene);
    expect(r.transform).toEqual({ ...start, x: 1060, y: 489 });
  });
  it("keeps the object inside the scene", () => {
    expect(moveTransform(start, box, 5000, 5000, scene).transform).toMatchObject({ x: 1920 - 200, y: 1080 - 100 });
    expect(moveTransform(start, box, -5000, -5000, scene).transform).toMatchObject({ x: 200, y: 100 });
  });
  it("never jumps an object that already sits outside the scene", () => {
    const outside = { ...start, x: -300 };
    expect(moveTransform(outside, box, 0, 0, scene).transform.x).toBe(-300);
    expect(moveTransform(outside, box, -10, 0, scene).transform.x).toBe(-300);
    expect(moveTransform(outside, box, 50, 0, scene).transform.x).toBe(-250);
  });
  it("keeps the anchor inside when the object is larger than the scene", () => {
    const big = { ...start, width: 4000 };
    const r = moveTransform(big, localBox({ ...rect("b"), transform: big }), 5000, 0, scene);
    expect(r.transform.x).toBe(1920);
  });
  it("snaps to the grid", () => {
    expect(moveTransform(start, box, 13, 27, scene, { grid: 20 }).transform).toMatchObject({ x: 980, y: 560 });
  });
  it("snaps an edge or centre to a guide within the threshold and reports it", () => {
    const r = moveTransform(start, box, 0, 0, scene, { guides: { xs: [1165], ys: [], threshold: 6 } });
    // right edge 1160 → 1165
    expect(r.transform.x).toBe(965);
    expect(r.guideX).toBe(1165);
    expect(r.guideY).toBeNull();
    const far = moveTransform(start, box, 0, 0, scene, { guides: { xs: [1180], ys: [], threshold: 6 } });
    expect(far.guideX).toBeNull();
    expect(far.transform.x).toBe(960);
  });
  it("guides win over the grid", () => {
    const r = moveTransform(start, box, 3, 0, scene, { grid: 20, guides: { xs: [960], ys: [], threshold: 6 } });
    expect(r.transform.x).toBe(960);
    expect(r.guideX).toBe(960);
  });
});

describe("nudgeTransform", () => {
  it("moves exactly and clamps to the scene", () => {
    const t = rect("a", { x: 960, y: 540, width: 400, height: 200 }).transform;
    const box = localBox(rect("a", { width: 400, height: 200 }));
    expect(nudgeTransform(t, box, 1, 0, scene)).toEqual({ ...t, x: 961 });
    expect(nudgeTransform(t, box, 0, -10, scene)).toEqual({ ...t, y: 530 });
    expect(nudgeTransform({ ...t, x: 1720 }, box, 10, 0, scene).x).toBe(1720);
  });
});

describe("resizeTransform", () => {
  const start = rect("a", { x: 500, y: 400, width: 200, height: 100 }).transform;

  it.each(Object.keys(RESIZE_HANDLES) as ResizeHandle[])("handle %s keeps the opposite side fixed (rotated 30°)", (h) => {
    const t = { ...start, rotation: 30 };
    const before = worldCorners(t, localBox({ ...rect("a"), transform: t }));
    const [hx, hy] = RESIZE_HANDLES[h];
    // Drag 40 units outward along the handle direction in local space, expressed in world space.
    const r = (30 * Math.PI) / 180;
    const ldx = hx * 40;
    const ldy = hy * 40;
    const next = resizeTransform(t, h, ldx * Math.cos(r) - ldy * Math.sin(r), ldx * Math.sin(r) + ldy * Math.cos(r));
    expect(next.width).toBe(200 + Math.abs(hx) * 40);
    expect(next.height).toBe(100 + Math.abs(hy) * 40);
    const after = worldCorners(next, localBox({ ...rect("a"), transform: next }));
    // corner order: tl, tr, br, bl — the corner opposite the handle stays put
    const oppositeIndex = (hx <= 0 ? (hy <= 0 ? 2 : 1) : hy <= 0 ? 3 : 0);
    expect(close(after[oppositeIndex]![0], before[oppositeIndex]![0], 0.02)).toBe(true);
    expect(close(after[oppositeIndex]![1], before[oppositeIndex]![1], 0.02)).toBe(true);
  });
  it("accounts for scale and never goes below the minimum size", () => {
    const scaled = { ...start, scaleX: 2 };
    expect(resizeTransform(scaled, "e", 40, 0).width).toBe(220);
    expect(resizeTransform(start, "e", -1000, 0).width).toBe(1);
  });
  it("Shift keeps proportions on corner handles", () => {
    const next = resizeTransform(start, "se", 100, 0, { keepAspect: true });
    expect(next.width).toBe(300);
    expect(next.height).toBe(150);
  });
  it("leaves zero-scale objects alone", () => {
    const flat = { ...start, scaleY: 0 };
    expect(resizeTransform(flat, "s", 0, 50)).toBe(flat);
  });
});

describe("rotateTransform", () => {
  const start = rect("a", { x: 0, y: 0, rotation: 0 }).transform;
  it("adds the angle swept around the anchor", () => {
    expect(rotateTransform(start, [0, -100], [100, 0]).rotation).toBe(90);
    expect(rotateTransform({ ...start, rotation: 10 }, [0, -100], [-100, 0]).rotation).toBe(-80);
  });
  it("snaps with Shift and normalises to (-180, 180]", () => {
    expect(rotateTransform(start, [0, -100], [100, -100]).rotation).toBe(45);
    expect(rotateTransform(start, [0, -100], [100, -90], 15).rotation).toBe(45);
    expect(normalizeDegrees(540)).toBe(180);
    expect(normalizeDegrees(-180)).toBe(180);
    expect(normalizeDegrees(-190)).toBe(170);
  });
});

describe("guideTargets", () => {
  it("includes scene edges/centre and other visible objects, not the moving one or hidden ones", () => {
    const a = rect("a", { x: 300, y: 300, width: 100, height: 100 });
    const b = rect("b", { x: 800, y: 600, width: 200, height: 100 });
    const hidden = rect("h", { x: 1500, y: 900, width: 10, height: 10 }, { visible: false });
    const g = guideTargets([a, b, hidden], "a", scene);
    expect(g.xs).toEqual([0, 960, 1920, 700, 800, 900]);
    expect(g.ys).toEqual([0, 540, 1080, 550, 600, 650]);
  });
});

describe("worldAabb / containsPoint", () => {
  it("bounds a rotated box", () => {
    const t = rect("a", { x: 0, y: 0, width: 100, height: 100, rotation: 45 }).transform;
    const b = worldAabb(t, localBox({ ...rect("a"), transform: t }));
    expect(close(b.right, Math.SQRT2 * 50)).toBe(true);
    expect(containsPoint(t, localBox({ ...rect("a"), transform: t }), 69, 0)).toBe(true);
  });
});

describe("Scene DSL compatibility", () => {
  it("manipulated transforms keep exactly the SceneTransform fields and still validate", () => {
    const obj = rect("a", { x: 960, y: 540, width: 400, height: 200 });
    const box = localBox(obj);
    let t = moveTransform(obj.transform, box, 123.7, -45.2, scene, { grid: 10 }).transform;
    t = resizeTransform(t, "ne", 33.3, -12.1, { keepAspect: true });
    t = rotateTransform(t, [t.x, t.y - 100], [t.x + 100, t.y - 100], 15);
    t = nudgeTransform(t, localBox({ ...obj, transform: t }), -10, 1, scene);
    expect(Object.keys(t).sort()).toEqual(Object.keys(obj.transform).sort());
    const schema: SceneSchema = { ...empty, objects: [{ ...obj, transform: t }] };
    const v = validateSceneSchema(JSON.parse(JSON.stringify(schema)));
    expect(v.success).toBe(true);
    if (v.success) expect(v.data).toEqual(schema);
  });
});
