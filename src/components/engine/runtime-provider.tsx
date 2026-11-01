"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { SceneRuntime } from "@/lib/engine/runtime/scene-runtime";
import type { RuntimeSnapshot } from "@/lib/engine/types";

// ============================================================
// Context
// ============================================================

interface RuntimeContextValue {
  runtime: SceneRuntime | null;
  snapshot: RuntimeSnapshot;
}

const DEFAULT_SNAPSHOT: RuntimeSnapshot = {
  status: "idle",
  elapsedMs: 0,
  currentSceneIndex: 0,
  frameCount: 0,
  fps: 0,
  renderTimeMs: 0,
};

const RuntimeContext = createContext<RuntimeContextValue>({
  runtime: null,
  snapshot: DEFAULT_SNAPSHOT,
});

// ============================================================
// RuntimeProvider
// ============================================================

interface RuntimeProviderProps {
  children: ReactNode;
  runtime: SceneRuntime;
}

/**
 * Provides a SceneRuntime and its current snapshot to any descendant
 * via useRuntime(). Polls for snapshot updates every 100ms.
 */
export function RuntimeProvider({ children, runtime }: RuntimeProviderProps) {
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot>(() =>
    runtime.getSnapshot()
  );

  useEffect(() => {
    const id = setInterval(() => {
      setSnapshot(runtime.getSnapshot());
    }, 100);
    return () => clearInterval(id);
  }, [runtime]);

  return (
    <RuntimeContext.Provider value={{ runtime, snapshot }}>
      {children}
    </RuntimeContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

export function useRuntime(): RuntimeContextValue {
  return useContext(RuntimeContext);
}
