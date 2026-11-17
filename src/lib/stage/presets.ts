// Default band layout. Audience faces +Z; the drum riser sits upstage (-Z).

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
      { id: "member-guitar", kind: "performer", label: "Guitar", position: [-2.5, 0, 0.5], rotationY: 0.3, locked: false },
      { id: "member-bass", kind: "performer", label: "Bass", position: [2.5, 0, 0.5], rotationY: -0.3, locked: false },
      { id: "member-drums", kind: "performer", label: "Drums", position: [0, 0, -1.25], rotationY: 0, locked: false },
      // Movable instruments
      { id: "mic-vocal", kind: "mic", label: "Vocal mic", position: [0, 0, 2.5], rotationY: 0, locked: false },
      { id: "guitar", kind: "guitar", label: "Guitar", position: [-2.5, 0, 1], rotationY: 0.3, locked: false },
      { id: "bass", kind: "bass", label: "Bass", position: [2.5, 0, 1], rotationY: -0.3, locked: false },
      { id: "keyboard", kind: "keyboard", label: "Keyboard", position: [-4.25, 0, -0.75], rotationY: 0.4, locked: false },
    ],
  };
}
