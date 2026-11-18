// Default band layout. Audience faces +Z; the drum riser sits upstage (-Z).
//
// Left/right are AUDIENCE left/right. Every camera preset looks from +Z toward -Z
// with +Y up, so screen-right is +X: audience-left = -X, audience-right = +X.
// (In theatre terms -X is "stage right" — the configurator's nudge buttons use that.)
//
//   Bass  → audience left  (-X)      Guitar, Keys → audience right (+X)
//   Vocal → center downstage         Drums, amps  → fixed backline (never move)
//
// This is only the layout for artists with no saved draft, and the target of the
// explicit "Default layout" button. Saved drafts and published versions are stored
// as-is and never rewritten from here.

import type { StageLayout } from "./types";

export function defaultStageLayout(artistId: string, now = new Date().toISOString()): StageLayout {
  return {
    version: 1,
    artistId,
    updatedAt: now,
    items: [
      // Locked backline
      { id: "drums", kind: "drums", label: "Drum kit", position: [0, 0, -2.5], rotationY: 0, locked: true },
      { id: "amp-guitar", kind: "amplifier", label: "Guitar amp", position: [-3.5, 0, -2.75], rotationY: 0, locked: true },
      { id: "amp-bass", kind: "amplifier", label: "Bass amp", position: [3.5, 0, -2.75], rotationY: 0, locked: true },
      { id: "amp-keys", kind: "amplifier", label: "Keys amp", position: [-5, 0, -2.75], rotationY: 0, locked: true },
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
