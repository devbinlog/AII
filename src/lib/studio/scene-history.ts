// Undo/redo history for the scene editor (pure; no React).
import type { SceneSchema } from "@/types";

export const HISTORY_LIMIT = 100;
/** Edits sharing a key within this window merge into one undo step (typing, nudging). */
export const COALESCE_MS = 700;

export interface History {
  past: SceneSchema[];
  present: SceneSchema;
  future: SceneSchema[];
  lastKey: string | null;
  lastAt: number;
}
export type HistoryAction =
  | { type: "edit"; fn: (s: SceneSchema) => SceneSchema; key: string | null; at: number }
  | { type: "undo" }
  | { type: "redo" };

/** Pure history reducer; edits sharing a key within COALESCE_MS merge into one undo step. */
export function historyReducer(h: History, a: HistoryAction): History {
  switch (a.type) {
    case "edit": {
      const next = a.fn(h.present);
      if (next === h.present) return h;
      const merge = a.key !== null && h.lastKey === a.key && a.at - h.lastAt < COALESCE_MS;
      return {
        past: merge ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
        lastKey: a.key,
        lastAt: a.at,
      };
    }
    case "undo": {
      const prev = h.past[h.past.length - 1];
      if (!prev) return h;
      return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future].slice(0, HISTORY_LIMIT), lastKey: null, lastAt: 0 };
    }
    case "redo": {
      const next = h.future[0];
      if (!next) return h;
      return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: h.future.slice(1), lastKey: null, lastAt: 0 };
    }
  }
}
