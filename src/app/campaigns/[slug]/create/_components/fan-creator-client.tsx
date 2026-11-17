"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SceneRuntime } from "@/lib/engine/runtime/scene-runtime";
import { SceneCanvas } from "@/components/engine/scene-canvas";
import { simulateAudioFrame } from "@/lib/engine/audio/mock-frame";
import { exportToPng } from "@/lib/export/png-export";
import { ParameterEditor } from "./parameter-editor";
import type {
  Campaign,
  EditableParameter,
  Experience,
  ExperienceVersion,
} from "@/types/domain";
import type { RuntimeSnapshot } from "@/lib/engine/types";

// ============================================================
// Types
// ============================================================

interface FanCreatorClientProps {
  campaign: Campaign;
  experience: Experience;
  experienceVersion: ExperienceVersion;
  editableParameters: EditableParameter[];
  isLoggedIn: boolean;
  campaignSlug: string;
}

type ParamValues = Record<string, unknown>;

const HISTORY_LIMIT = 50;
const HISTORY_COALESCE_MS = 600;

function shallowEqualParams(a: ParamValues, b: ParamValues): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (!Object.is(a[k], b[k])) return false;
  }
  return true;
}

interface SavedArtwork {
  id: string;
}

// ============================================================
// LocalStorage key
// ============================================================

function getDraftKey(slug: string): string {
  return `aii_draft_${slug}`;
}

interface DraftData {
  title: string;
  paramValues: ParamValues;
  captureFrameMs: number;
}

// ============================================================
// Helpers: apply parameter values to schema objects
// ============================================================

function applyParamToSchema(
  schema: ExperienceVersion["snapshot"]["sceneSchemas"][string],
  param: EditableParameter,
  value: unknown
): ExperienceVersion["snapshot"]["sceneSchemas"][string] {
  // Deep clone the schema to avoid mutating the original
  const cloned: typeof schema = JSON.parse(JSON.stringify(schema)) as typeof schema;

  const objIndex = cloned.objects.findIndex((o) => o.id === param.objectId);
  if (objIndex === -1) return cloned;

  const obj = cloned.objects[objIndex];
  if (!obj) return cloned;

  switch (param.property) {
    case "style.fill":
      if (typeof value === "string") {
        cloned.objects[objIndex] = {
          ...obj,
          style: { ...obj.style, fill: value },
        };
      }
      break;
    case "style.stroke":
      if (typeof value === "string") {
        cloned.objects[objIndex] = {
          ...obj,
          style: { ...obj.style, stroke: value },
        };
      }
      break;
    case "transform.opacity":
      if (typeof value === "number") {
        cloned.objects[objIndex] = {
          ...obj,
          transform: { ...obj.transform, opacity: value },
        };
      }
      break;
    case "transform.rotation":
      if (typeof value === "number") {
        cloned.objects[objIndex] = {
          ...obj,
          transform: { ...obj.transform, rotation: value },
        };
      }
      break;
    case "data.content":
      if (typeof value === "string" && obj.data.type === "text") {
        cloned.objects[objIndex] = {
          ...obj,
          data: { type: "text", content: value },
        };
      }
      break;
  }

  return cloned;
}

// Build a merged schema for a given scene with all param values applied
function buildMergedSchema(
  sceneId: string,
  sceneSchemas: ExperienceVersion["snapshot"]["sceneSchemas"],
  params: EditableParameter[],
  paramValues: ParamValues
): ExperienceVersion["snapshot"]["sceneSchemas"][string] | null {
  const base = sceneSchemas[sceneId];
  if (!base) return null;

  let schema = base;
  for (const param of params) {
    if (param.sceneId !== sceneId) continue;
    const value = paramValues[param.id] ?? param.defaultValue;
    schema = applyParamToSchema(schema, param, value);
  }
  return schema;
}

// ============================================================
// FanCreatorClient
// ============================================================

export function FanCreatorClient({
  campaign,
  experience,
  experienceVersion,
  editableParameters,
  isLoggedIn,
  campaignSlug,
}: FanCreatorClientProps) {
  // ── State ────────────────────────────────────────────────────
  const [paramValues, setParamValues] = useState<ParamValues>(() => {
    const defaults: ParamValues = {};
    for (const p of editableParameters) {
      defaults[p.id] = p.defaultValue;
    }
    return defaults;
  });

  const [title, setTitle] = useState<string>(
    `${experience.title} — My Artwork`
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot>({
    status: "idle",
    elapsedMs: 0,
    currentSceneIndex: 0,
    frameCount: 0,
    fps: 0,
    renderTimeMs: 0,
  });
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);

  // Save/export state
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    ok: boolean;
    message: string;
    artwork?: SavedArtwork;
  } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Parameter edit history (undo / redo)
  const [undoStack, setUndoStack] = useState<ParamValues[]>([]);
  const [redoStack, setRedoStack] = useState<ParamValues[]>([]);
  const lastEditRef = useRef<{ key: string; at: number } | null>(null);

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Runtime ─────────────────────────────────────────────────
  const runtimeRef = useRef<SceneRuntime | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(false);

  // Scenes from experienceVersion snapshot, sorted by order
  const sortedScenes = useMemo(
    () =>
      [...experienceVersion.snapshot.scenes].sort((a, b) => a.order - b.order),
    [experienceVersion]
  );

  const currentScene = sortedScenes[currentSceneIdx];

  // ── Init runtime once ────────────────────────────────────────
  useEffect(() => {
    const rt = new SceneRuntime(42);
    runtimeRef.current = rt;

    rt.on("play", () => setIsPlaying(true));
    rt.on("resume", () => setIsPlaying(true));
    rt.on("pause", () => setIsPlaying(false));
    rt.on("reset", () => setIsPlaying(false));
    rt.on("ended", () => setIsPlaying(false));

    // Set mock audio
    rt.setMockAudioFn(simulateAudioFrame);

    setRuntimeReady(true);

    return () => {
      rt.dispose();
      runtimeRef.current = null;
    };
  }, []);

  // ── Snapshot polling ─────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (runtimeRef.current) {
        setSnapshot(runtimeRef.current.getSnapshot());
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  // ── Load schema for current scene ───────────────────────────
  useEffect(() => {
    if (!runtimeRef.current || !currentScene) return;
    const rt = runtimeRef.current;

    const mergedSchema = buildMergedSchema(
      currentScene.sceneId,
      experienceVersion.snapshot.sceneSchemas,
      editableParameters,
      paramValues
    );
    if (!mergedSchema) return;

    rt.setSchema(mergedSchema);
    rt.reset();
    rt.play();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSceneIdx, runtimeReady]);

  // ── Restore draft from localStorage ─────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(getDraftKey(campaignSlug));
      if (raw) {
        const draft = JSON.parse(raw) as DraftData;
        if (draft.paramValues) setParamValues(draft.paramValues);
        if (draft.title) setTitle(draft.title);
      }
    } catch {
      // Ignore parse errors
    }
  // Run only on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Debounced schema update & auto-save on param changes ─────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Update runtime schema
      if (runtimeRef.current && currentScene) {
        const mergedSchema = buildMergedSchema(
          currentScene.sceneId,
          experienceVersion.snapshot.sceneSchemas,
          editableParameters,
          paramValues
        );
        if (mergedSchema) {
          runtimeRef.current.setSchema(mergedSchema);
          // Render a preview frame without resetting playback position
          if (!isPlaying) {
            runtimeRef.current.reset();
          }
        }
      }

      // Auto-save to localStorage
      try {
        const draft: DraftData = {
          title,
          paramValues,
          captureFrameMs: runtimeRef.current?.getSnapshot().elapsedMs ?? 0,
        };
        localStorage.setItem(getDraftKey(campaignSlug), JSON.stringify(draft));
      } catch {
        // localStorage may not be available (private mode, storage full, etc.)
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramValues, title]);

  // ── Handlers ─────────────────────────────────────────────────

  // Records the previous values on the undo stack and clears redo.
  // Consecutive edits of the same parameter (e.g. a slider drag) within
  // HISTORY_COALESCE_MS collapse into one undo step.
  const applyParamEdit = useCallback(
    (next: ParamValues, coalesceKey: string | null) => {
      if (shallowEqualParams(next, paramValues)) return;
      const nowMs = Date.now();
      const last = lastEditRef.current;
      const coalesce =
        coalesceKey !== null &&
        last?.key === coalesceKey &&
        nowMs - last.at < HISTORY_COALESCE_MS;
      if (!coalesce) {
        setUndoStack((s) => [...s, paramValues].slice(-HISTORY_LIMIT));
      }
      setRedoStack([]);
      lastEditRef.current = coalesceKey ? { key: coalesceKey, at: nowMs } : null;
      setParamValues(next);
    },
    [paramValues]
  );

  const handleParamChange = useCallback(
    (paramId: string, value: unknown) => {
      applyParamEdit({ ...paramValues, [paramId]: value }, paramId);
    },
    [applyParamEdit, paramValues]
  );

  const handleParamReset = useCallback(
    (paramId: string) => {
      const param = editableParameters.find((p) => p.id === paramId);
      if (!param) return;
      applyParamEdit({ ...paramValues, [paramId]: param.defaultValue }, null);
    },
    [applyParamEdit, editableParameters, paramValues]
  );

  const handleResetAll = useCallback(() => {
    const defaults: ParamValues = {};
    for (const p of editableParameters) {
      defaults[p.id] = p.defaultValue;
    }
    applyParamEdit(defaults, null);
  }, [applyParamEdit, editableParameters]);

  const handleUndo = useCallback(() => {
    const prev = undoStack[undoStack.length - 1];
    if (prev === undefined) return;
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [paramValues, ...s].slice(0, HISTORY_LIMIT));
    lastEditRef.current = null;
    setParamValues(prev);
  }, [undoStack, paramValues]);

  const handleRedo = useCallback(() => {
    const next = redoStack[0];
    if (next === undefined) return;
    setRedoStack((s) => s.slice(1));
    setUndoStack((s) => [...s, paramValues].slice(-HISTORY_LIMIT));
    lastEditRef.current = null;
    setParamValues(next);
  }, [redoStack, paramValues]);

  // Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z or Ctrl+Y = redo.
  // Text fields keep their native undo.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          target.tagName === "TEXTAREA" ||
          (target.tagName === "INPUT" &&
            ["text", "search", "url", "email", "number"].includes(
              (target as HTMLInputElement).type
            )))
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo, handleRedo]);

  const handlePlayPause = useCallback(() => {
    const rt = runtimeRef.current;
    if (!rt) return;
    if (isPlaying) {
      rt.pause();
    } else if (snapshot.status === "paused") {
      rt.resume();
    } else {
      rt.play();
    }
  }, [isPlaying, snapshot.status]);

  // Build customization object for saving
  function buildCustomization() {
    return {
      versionId: experienceVersion.id,
      editableParameters: paramValues,
      sceneStates: {},
      captureFrameMs: runtimeRef.current?.getSnapshot().elapsedMs ?? 0,
      deterministicSeed: 42,
    };
  }

  const handleSaveDraft = useCallback(async () => {
    if (!isLoggedIn) {
      setSaveResult({ ok: false, message: "Save requires login" });
      return;
    }
    setIsSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/artworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          campaignId: campaign.id,
          experienceVersionId: experienceVersion.id,
          title,
          customization: buildCustomization(),
          status: "draft",
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        artwork?: { id: string };
        error?: { message: string };
      };
      if (data.ok && data.artwork) {
        setSaveResult({
          ok: true,
          message: "Draft saved!",
          artwork: { id: data.artwork.id },
        });
        // Clear localStorage draft on successful save
        localStorage.removeItem(getDraftKey(campaignSlug));
      } else {
        setSaveResult({
          ok: false,
          message: data.error?.message ?? "Save failed",
        });
      }
    } catch (err) {
      setSaveResult({
        ok: false,
        message: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setIsSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, campaign.id, experienceVersion.id, title, paramValues]);

  const handlePublish = useCallback(async () => {
    if (!isLoggedIn) {
      setSaveResult({ ok: false, message: "Save requires login" });
      return;
    }
    setIsSaving(true);
    setSaveResult(null);
    try {
      // Step 1: Create artwork
      const createRes = await fetch("/api/artworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          campaignId: campaign.id,
          experienceVersionId: experienceVersion.id,
          title,
          customization: buildCustomization(),
        }),
      });
      const createData = (await createRes.json()) as {
        ok: boolean;
        artwork?: { id: string };
        error?: { message: string };
      };
      if (!createData.ok || !createData.artwork) {
        setSaveResult({
          ok: false,
          message: createData.error?.message ?? "Create failed",
        });
        return;
      }

      // Step 2: Publish
      const patchRes = await fetch(`/api/artworks/${createData.artwork.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "published", permission: "public" }),
      });
      const patchData = (await patchRes.json()) as {
        ok: boolean;
        artwork?: { id: string };
        error?: { message: string };
      };
      if (patchData.ok && patchData.artwork) {
        setSaveResult({
          ok: true,
          message: "Published!",
          artwork: { id: patchData.artwork.id },
        });
        localStorage.removeItem(getDraftKey(campaignSlug));
      } else {
        setSaveResult({
          ok: false,
          message: patchData.error?.message ?? "Publish failed",
        });
      }
    } catch (err) {
      setSaveResult({
        ok: false,
        message: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setIsSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, campaign.id, experienceVersion.id, title, paramValues]);

  const handleExportPng = useCallback(async () => {
    const rt = runtimeRef.current;
    if (!rt) return;
    setIsExporting(true);
    setExportError(null);
    const captureMs = rt.getSnapshot().elapsedMs;
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    try {
      await exportToPng({
        runtime: rt,
        captureFrameMs: captureMs,
        width: 1920,
        height: 1080,
        filename: `freefallers-moonwave-${dateStr}.png`,
      });
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Export failed"
      );
    } finally {
      setIsExporting(false);
    }
  }, []);

  // ── Duration for seek slider ─────────────────────────────────
  const currentSchemaDuration = useMemo(() => {
    if (!currentScene) return null;
    return (
      experienceVersion.snapshot.sceneSchemas[currentScene.sceneId]?.duration ??
      null
    );
  }, [currentScene, experienceVersion]);

  // ── Render ───────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col min-h-[calc(100vh-3.5rem)]"
      style={{
        backgroundColor: "var(--color-neutral-950)",
        color: "var(--color-neutral-50)",
      }}
    >
      {/* Header bar */}
      <header
        className="flex items-center justify-between px-6 py-3 border-b shrink-0"
        style={{ borderColor: "var(--color-neutral-800)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="font-mono text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded"
            style={{
              backgroundColor: "var(--color-accent)",
              color: "#fff",
            }}
          >
            Creator
          </span>
          <span
            className="font-semibold text-sm truncate"
            style={{ color: "var(--color-neutral-200)" }}
          >
            {campaign.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isLoggedIn && (
            <span
              className="hidden sm:block text-xs px-3 py-1 rounded border"
              style={{
                color: "var(--color-neutral-400)",
                borderColor: "var(--color-neutral-700)",
              }}
            >
              Guest mode — save requires login
            </span>
          )}
        </div>
      </header>

      {/* Main content: left panel + right canvas */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel ────────────────────────────────────────── */}
        <aside
          className="w-80 shrink-0 flex flex-col border-r overflow-y-auto"
          style={{ borderColor: "var(--color-neutral-800)" }}
        >
          {/* Title input */}
          <section className="p-5 border-b" style={{ borderColor: "var(--color-neutral-800)" }}>
            <label
              className="block text-xs font-mono font-semibold uppercase tracking-widest mb-2"
              style={{ color: "var(--color-neutral-400)" }}
            >
              Artwork Title
            </label>
            <input
              type="text"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded text-sm font-semibold"
              style={{
                backgroundColor: "var(--color-neutral-900)",
                color: "var(--color-neutral-50)",
                border: "1px solid var(--color-neutral-700)",
                outline: "none",
              }}
              placeholder="Name your artwork..."
            />
          </section>

          {/* Scene tabs (if multiple scenes) */}
          {sortedScenes.length > 1 && (
            <section className="p-5 border-b" style={{ borderColor: "var(--color-neutral-800)" }}>
              <p
                className="text-xs font-mono font-semibold uppercase tracking-widest mb-2"
                style={{ color: "var(--color-neutral-400)" }}
              >
                Scene
              </p>
              <div className="flex gap-1 flex-wrap">
                {sortedScenes.map((s, idx) => (
                  <button
                    key={s.sceneId}
                    onClick={() => setCurrentSceneIdx(idx)}
                    className="px-3 py-1 rounded text-xs font-mono font-semibold transition-colors"
                    style={{
                      backgroundColor:
                        idx === currentSceneIdx
                          ? "var(--color-accent)"
                          : "var(--color-neutral-800)",
                      color:
                        idx === currentSceneIdx
                          ? "#fff"
                          : "var(--color-neutral-300)",
                      border: "1px solid transparent",
                    }}
                  >
                    Scene {idx + 1}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Editable parameters for current scene */}
          <section className="p-5 flex-1">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-xs font-mono font-semibold uppercase tracking-widest"
                style={{ color: "var(--color-neutral-400)" }}
              >
                Parameters
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  title="Undo (Ctrl+Z)"
                  className="text-xs font-mono px-2 py-0.5 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    color: "var(--color-neutral-400)",
                    border: "1px solid var(--color-neutral-700)",
                  }}
                >
                  Undo
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  title="Redo (Ctrl+Shift+Z)"
                  className="text-xs font-mono px-2 py-0.5 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    color: "var(--color-neutral-400)",
                    border: "1px solid var(--color-neutral-700)",
                  }}
                >
                  Redo
                </button>
                <button
                  onClick={handleResetAll}
                  className="text-xs font-mono px-2 py-0.5 rounded"
                  style={{
                    color: "var(--color-neutral-400)",
                    border: "1px solid var(--color-neutral-700)",
                  }}
                >
                  Reset All
                </button>
              </div>
            </div>

            {editableParameters.length === 0 ? (
              <p
                className="text-sm"
                style={{ color: "var(--color-neutral-500)" }}
              >
                No editable parameters for this experience.
              </p>
            ) : (
              <div className="flex flex-col gap-5">
                {editableParameters
                  .filter(
                    (p) => p.sceneId === (currentScene?.sceneId ?? "")
                  )
                  .map((param) => (
                    <ParameterEditor
                      key={param.id}
                      param={param}
                      value={paramValues[param.id] ?? param.defaultValue}
                      onChange={handleParamChange}
                      onReset={handleParamReset}
                    />
                  ))}
                {editableParameters.filter(
                  (p) => p.sceneId === (currentScene?.sceneId ?? "")
                ).length === 0 && (
                  <p
                    className="text-sm"
                    style={{ color: "var(--color-neutral-500)" }}
                  >
                    No parameters for this scene.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Save controls */}
          <section
            className="p-5 border-t"
            style={{ borderColor: "var(--color-neutral-800)" }}
          >
            {/* Save result */}
            {saveResult && (
              <div
                className="mb-3 px-3 py-2 rounded text-xs font-mono"
                style={{
                  backgroundColor: saveResult.ok
                    ? "rgba(74,222,128,0.08)"
                    : "rgba(232,25,44,0.08)",
                  color: saveResult.ok ? "#4ade80" : "var(--color-accent)",
                  border: `1px solid ${saveResult.ok ? "#4ade8040" : "var(--color-accent)40"}`,
                }}
              >
                {saveResult.message}
                {saveResult.ok && saveResult.artwork && (
                  <span style={{ color: "var(--color-neutral-400)" }}>
                    {" "}· artwork/{saveResult.artwork.id}
                  </span>
                )}
              </div>
            )}

            {/* Guest notice */}
            {!isLoggedIn && (
              <p
                className="mb-3 text-xs"
                style={{ color: "var(--color-neutral-500)" }}
              >
                Sign in to save your artwork. You can still create and export.
              </p>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={() => void handleSaveDraft()}
                disabled={isSaving || !isLoggedIn}
                className="w-full py-2 rounded text-sm font-semibold transition-colors disabled:opacity-40"
                style={{
                  backgroundColor: "var(--color-neutral-800)",
                  color: "var(--color-neutral-50)",
                  border: "1px solid var(--color-neutral-700)",
                }}
              >
                {isSaving ? "Saving..." : "Save Draft"}
              </button>
              <button
                onClick={() => void handlePublish()}
                disabled={isSaving || !isLoggedIn}
                className="w-full py-2 rounded text-sm font-semibold transition-colors disabled:opacity-40"
                style={{
                  backgroundColor: "var(--color-accent)",
                  color: "#fff",
                }}
              >
                {isSaving ? "Publishing..." : "Publish"}
              </button>
            </div>
          </section>
        </aside>

        {/* ── Right Panel (Canvas) ──────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Canvas area */}
          <div className="flex-1 flex items-center justify-center p-4" style={{ minHeight: 0 }}>
            <div
              className="relative overflow-hidden rounded"
              style={{
                aspectRatio: "16/9",
                width: "100%",
                maxWidth: "min(100%, calc((100vh - 14rem) * 16 / 9))",
                border: "1px solid var(--color-neutral-800)",
                backgroundColor: "#0a0a0a",
              }}
            >
              {runtimeReady && runtimeRef.current ? (
                <SceneCanvas
                  runtime={runtimeRef.current}
                  className="absolute inset-0"
                  style={{ width: "100%", height: "100%" }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="text-xs font-mono"
                    style={{ color: "var(--color-neutral-500)" }}
                  >
                    Loading...
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Playback controls */}
          <div
            className="px-6 py-4 border-t flex items-center gap-4 flex-wrap"
            style={{ borderColor: "var(--color-neutral-800)" }}
          >
            {/* Play/Pause */}
            <button
              onClick={handlePlayPause}
              className="px-4 py-2 rounded text-sm font-mono font-semibold transition-colors"
              style={{
                backgroundColor: isPlaying
                  ? "var(--color-neutral-800)"
                  : "var(--color-accent)",
                color: "#fff",
                border: isPlaying
                  ? "1px solid var(--color-neutral-700)"
                  : "none",
              }}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>

            {/* Seek slider — only shown if scene has a duration */}
            {currentSchemaDuration !== null && (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span
                  className="text-xs font-mono shrink-0"
                  style={{ color: "var(--color-neutral-400)" }}
                >
                  {(snapshot.elapsedMs / 1000).toFixed(1)}s
                </span>
                <input
                  type="range"
                  min={0}
                  max={currentSchemaDuration}
                  step={100}
                  value={snapshot.elapsedMs}
                  onChange={(e) => {
                    runtimeRef.current?.seek(parseFloat(e.target.value));
                  }}
                  className="flex-1 h-1 cursor-pointer"
                  style={{ accentColor: "var(--color-accent)" }}
                />
                <span
                  className="text-xs font-mono shrink-0"
                  style={{ color: "var(--color-neutral-400)" }}
                >
                  {(currentSchemaDuration / 1000).toFixed(1)}s
                </span>
              </div>
            )}

            {/* Status info */}
            <div
              className="flex gap-3 items-center font-mono text-xs ml-auto"
              style={{ color: "var(--color-neutral-500)" }}
            >
              <span>{snapshot.fps} fps</span>
              <span
                className="capitalize"
                style={{ color: "var(--color-neutral-400)" }}
              >
                {snapshot.status}
              </span>
            </div>

            {/* Export PNG button */}
            <button
              onClick={() => void handleExportPng()}
              disabled={isExporting}
              className="px-4 py-2 rounded text-sm font-mono font-semibold transition-colors disabled:opacity-50"
              style={{
                backgroundColor: "var(--color-neutral-800)",
                color: "var(--color-neutral-50)",
                border: "1px solid var(--color-neutral-700)",
              }}
            >
              {isExporting ? "Exporting..." : "Export PNG"}
            </button>
          </div>

          {/* Export error */}
          {exportError && (
            <div
              className="mx-6 mb-4 px-3 py-2 rounded text-xs font-mono"
              style={{
                backgroundColor: "rgba(232,25,44,0.08)",
                color: "var(--color-accent)",
                border: "1px solid rgba(232,25,44,0.25)",
              }}
            >
              {exportError}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
