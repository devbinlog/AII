// Default band layout. Audience faces +Z; the drum riser sits upstage (-Z).
//
// Left/right are AUDIENCE left/right. Every camera preset looks from +Z toward -Z
// with +Y up, so screen-right is +X: audience-left = -X, audience-right = +X.
// (In theatre terms -X is "stage right" — the configurator's nudge buttons use that.)
//
//   Bass  → audience left  (-X)      Guitar, Keys → audience right (+X)
//   Vocal → center downstage         Drums        → center backline
//   Each amp sits behind its player (backline v2): bass amp left, guitar and keys right.
//
// COMPATIBILITY POLICY (backline versions)
//  • New layouts and the explicit "Default layout" button use CURRENT_BACKLINE.
//  • A stored draft is validated against ITS OWN backline version, so it loads and
//    re-saves without any coordinate change. Reads never write.
//  • Moving a draft to the current backline is an explicit artist action
//    (`upgradeBackline`, "Update backline" in the editor) that only moves locked
//    gear and only persists when the artist saves.
//  • Saving an older backline than the one stored is rejected (no downgrade).
//  • Published versions are immutable snapshots and never migrated.

import { CURRENT_BACKLINE, type BacklineVersion, type StageItem, type StageLayout, type Vec3 } from "./types";

/** Locked amp positions per backline version. Drums are the same in every version. */
const AMPS: Record<BacklineVersion, Record<"amp-guitar" | "amp-bass" | "amp-keys", Vec3>> = {
  1: { "amp-guitar": [-3.5, 0, -2.75], "amp-bass": [3.5, 0, -2.75], "amp-keys": [-5, 0, -2.75] },
  2: { "amp-guitar": [3.5, 0, -2.75], "amp-bass": [-3.5, 0, -2.75], "amp-keys": [5, 0, -2.75] },
};

export function defaultStageLayout(artistId: string, now = new Date().toISOString(), backline: BacklineVersion = CURRENT_BACKLINE): StageLayout {
  const amps = AMPS[backline];
  return {
    version: 1,
    artistId,
    updatedAt: now,
    backlineVersion: backline,
    items: [
      // Locked backline
      { id: "drums", kind: "drums", label: "Drum kit", position: [0, 0, -2.5], rotationY: 0, locked: true },
      { id: "amp-guitar", kind: "amplifier", label: "Guitar amp", position: [...amps["amp-guitar"]], rotationY: 0, locked: true },
      { id: "amp-bass", kind: "amplifier", label: "Bass amp", position: [...amps["amp-bass"]], rotationY: 0, locked: true },
      { id: "amp-keys", kind: "amplifier", label: "Keys amp", position: [...amps["amp-keys"]], rotationY: 0, locked: true },
      // Hologram members
      { id: "member-vocal", kind: "performer", label: "Vocal", position: [0, 0, 1.75], rotationY: 0, locked: false },
      { id: "member-guitar", kind: "performer", label: "Guitar", position: [2.5, 0, 0.5], rotationY: -0.3, locked: false },
      { id: "member-bass", kind: "performer", label: "Bass", position: [-2.5, 0, 0.5], rotationY: 0.3, locked: false },
      { id: "member-drums", kind: "performer", label: "Drums", position: [0, 0, -1.25], rotationY: 0, locked: false },
      { id: "member-keys", kind: "performer", label: "Keys", position: [4.5, 0, -1.6], rotationY: -0.4, locked: false },
      // Movable instruments
      { id: "mic-vocal", kind: "mic", label: "Vocal mic", position: [0, 0, 2.5], rotationY: 0, locked: false },
      { id: "guitar", kind: "guitar", label: "Guitar", position: [2.5, 0, 1], rotationY: -0.3, locked: false },
      { id: "bass", kind: "bass", label: "Bass", position: [-2.5, 0, 1], rotationY: 0.3, locked: false },
      { id: "keyboard", kind: "keyboard", label: "Keyboard", position: [4.25, 0, -0.75], rotationY: -0.4, locked: false },
    ],
  };
}

const samePos = (a: Vec3, b: Vec3) => a.every((v, i) => Math.abs(v - b[i]!) < 1e-6);

/**
 * The backline a layout was arranged against. An explicit `backlineVersion` wins;
 * an unversioned layout is matched by where its amps actually are (so drafts saved
 * before versioning resolve correctly), falling back to the original backline 1.
 */
export function backlineOf(layout: Pick<StageLayout, "items" | "backlineVersion">): BacklineVersion {
  if (layout.backlineVersion) return layout.backlineVersion;
  const amp = (id: string) => layout.items.find((i: StageItem) => i.id === id)?.position;
  for (const v of [CURRENT_BACKLINE, 1] as BacklineVersion[]) {
    const ids = Object.keys(AMPS[v]) as (keyof (typeof AMPS)[1])[];
    if (ids.every((id) => { const p = amp(id); return p !== undefined && samePos(p, AMPS[v][id]); })) return v;
  }
  return 1;
}

/** The validation reference for a layout: the default arranged on that layout's backline. */
export function referenceFor(layout: Pick<StageLayout, "items" | "backlineVersion">, artistId: string): StageLayout {
  return defaultStageLayout(artistId, undefined, backlineOf(layout));
}

/**
 * Explicit, artist-initiated move to the current backline: locked gear goes to the
 * current positions; every member and movable instrument keeps its coordinates.
 */
export function upgradeBackline(layout: StageLayout): StageLayout {
  const ref = defaultStageLayout(layout.artistId);
  const byId = new Map(ref.items.map((i) => [i.id, i]));
  return {
    ...layout,
    backlineVersion: CURRENT_BACKLINE,
    items: layout.items.map((item) => {
      const r = byId.get(item.id);
      return r && r.locked ? { ...item, position: [...r.position] as Vec3, rotationY: r.rotationY, locked: true } : item;
    }),
  };
}
