// Screen-space label placement (pure, framework-free; unit-tested).
// Works on already-projected anchors, so stage objects never move to make room.

export interface LabelInput {
  id: string;
  /** Anchor in CSS pixels (label center when not displaced). */
  x: number;
  y: number;
  /** Normalized depth from projection (smaller = nearer the camera). */
  depth: number;
  width: number;
  height: number;
  selected: boolean;
}

export interface LabelPlacement {
  id: string;
  x: number;
  y: number;
  /** "anchor" = at its object, "shifted" = moved to avoid a neighbour, "hidden" = no room. */
  state: "anchor" | "shifted" | "hidden";
}

const GAP = 3;

/** Candidate offsets in label-size units, tried in order. */
const CANDIDATES: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0, -1],
  [0.6, 0],
  [-0.6, 0],
  [0.6, -1],
  [-0.6, -1],
  [0, -2],
];

interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
}
const overlaps = (a: Rect, b: Rect) => a.l < b.r + GAP && b.l < a.r + GAP && a.t < b.b + GAP && b.t < a.b + GAP;

/**
 * Greedy placement: the selected label first, then nearer labels before farther
 * ones. Each label takes the first candidate slot that is inside the viewport and
 * clear of already placed labels; if none is clear it is hidden — except the
 * selected label, which always shows at its anchor.
 */
export function placeLabels(labels: LabelInput[], viewport: { width: number; height: number }): LabelPlacement[] {
  const order = [...labels].sort((a, b) => Number(b.selected) - Number(a.selected) || a.depth - b.depth || a.id.localeCompare(b.id));
  const placed: Rect[] = [];
  const out = new Map<string, LabelPlacement>();
  for (const l of order) {
    const hw = l.width / 2;
    const hh = l.height / 2;
    const clampX = (x: number) => Math.min(viewport.width - hw - 2, Math.max(hw + 2, x));
    const clampY = (y: number) => Math.min(viewport.height - hh - 2, Math.max(hh + 2, y));
    let result: LabelPlacement | null = null;
    for (const [i, [cx, cy]] of CANDIDATES.entries()) {
      const x = clampX(l.x + cx * (l.width + GAP));
      const y = clampY(l.y + cy * (l.height + GAP));
      const rect = { l: x - hw, t: y - hh, r: x + hw, b: y + hh };
      if (placed.some((p) => overlaps(p, rect))) continue;
      placed.push(rect);
      result = { id: l.id, x, y, state: i === 0 ? "anchor" : "shifted" };
      break;
    }
    if (!result && l.selected) {
      const x = clampX(l.x);
      const y = clampY(l.y);
      placed.push({ l: x - hw, t: y - hh, r: x + hw, b: y + hh });
      result = { id: l.id, x, y, state: "anchor" };
    }
    out.set(l.id, result ?? { id: l.id, x: l.x, y: l.y, state: "hidden" });
  }
  return labels.map((l) => out.get(l.id)!);
}
