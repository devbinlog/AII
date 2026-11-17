// Generic undo/redo history (pure reducer).

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export type HistoryAction<T> =
  | { type: "set"; value: T }       // new step
  | { type: "replace"; value: T }   // update present without a new step (e.g. during a drag)
  | { type: "commit"; from: T }     // finish a drag: record `from` as one step
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; value: T };    // load: clear history

export const HISTORY_LIMIT = 100;

export function initHistory<T>(value: T): HistoryState<T> {
  return { past: [], present: value, future: [] };
}

export function historyReducer<T>(state: HistoryState<T>, action: HistoryAction<T>): HistoryState<T> {
  switch (action.type) {
    case "set":
      if (action.value === state.present) return state;
      return { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present: action.value, future: [] };
    case "replace":
      return action.value === state.present ? state : { ...state, present: action.value };
    case "commit":
      if (action.from === state.present) return state;
      return { past: [...state.past, action.from].slice(-HISTORY_LIMIT), present: state.present, future: [] };
    case "undo": {
      const prev = state.past[state.past.length - 1];
      if (prev === undefined) return state;
      return { past: state.past.slice(0, -1), present: prev, future: [state.present, ...state.future] };
    }
    case "redo": {
      const next = state.future[0];
      if (next === undefined) return state;
      return { past: [...state.past, state.present], present: next, future: state.future.slice(1) };
    }
    case "reset":
      return initHistory(action.value);
  }
}
