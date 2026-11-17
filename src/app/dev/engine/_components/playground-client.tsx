"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { SceneRuntime } from "@/lib/engine/runtime/scene-runtime";
import { SceneCanvas } from "@/components/engine/scene-canvas";
import { validateSceneSchema } from "@/lib/engine/schema";
import { createMockAudioFrame } from "@/lib/engine/audio/mock-frame";
import { MOCK_SCENES } from "@/lib/mock/fixtures";
import type { RuntimeSnapshot } from "@/lib/engine/types";

// ============================================================
// Types
// ============================================================

interface SliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
}

// ============================================================
// Sub-components
// ============================================================

function AudioSlider({ label, value, onChange }: SliderProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs w-14 shrink-0" style={{ color: "var(--color-fg-muted)" }}>
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 accent-[var(--color-accent)] cursor-pointer"
      />
      <span className="font-mono text-xs w-10 text-right" style={{ color: "var(--color-fg-muted)" }}>
        {value.toFixed(2)}
      </span>
    </div>
  );
}

// ============================================================
// EnginePlaygroundClient
// ============================================================

export function EnginePlaygroundClient() {
  // ── Runtime ref (stable, no re-renders on change) ──────────
  const runtimeRef = useRef<SceneRuntime | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string>(
    MOCK_SCENES[0]?.id ?? ""
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

  // ── Audio sliders ──────────────────────────────────────────
  const [bass, setBass] = useState(0.3);
  const [mid, setMid] = useState(0.2);
  const [treble, setTreble] = useState(0.15);
  const [overall, setOverall] = useState(0.25);

  // ── JSON validator ─────────────────────────────────────────
  const [jsonInput, setJsonInput] = useState("");
  const [validationResult, setValidationResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // ── Initialise runtime once ────────────────────────────────
  useEffect(() => {
    const rt = new SceneRuntime(42);
    runtimeRef.current = rt;

    // Subscribe to status events to keep UI in sync
    const unsub = [
      rt.on("play", () => setIsPlaying(true)),
      rt.on("pause", () => setIsPlaying(false)),
      rt.on("resume", () => setIsPlaying(true)),
      rt.on("reset", () => setIsPlaying(false)),
      rt.on("ended", () => setIsPlaying(false)),
    ];

    return () => {
      unsub.forEach((fn) => fn());
      rt.dispose();
    };
  }, []);

  // ── Snapshot polling ───────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (runtimeRef.current) {
        setSnapshot(runtimeRef.current.getSnapshot());
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  // ── Sync mock audio fn when sliders change ─────────────────
  const bassRef = useRef(bass);
  const midRef = useRef(mid);
  const trebleRef = useRef(treble);
  const overallRef = useRef(overall);
  bassRef.current = bass;
  midRef.current = mid;
  trebleRef.current = treble;
  overallRef.current = overall;

  useEffect(() => {
    if (!runtimeRef.current) return;
    runtimeRef.current.setMockAudioFn(() =>
      createMockAudioFrame({
        bass: bassRef.current,
        mid: midRef.current,
        treble: trebleRef.current,
        overall: overallRef.current,
      })
    );
  }, [bass, mid, treble, overall]);

  // ── Scene selection: load schema and auto-play ─────────────
  useEffect(() => {
    if (!runtimeRef.current || !selectedSceneId) return;
    const scene = MOCK_SCENES.find((s) => s.id === selectedSceneId);
    if (!scene) return;
    const rt = runtimeRef.current;
    rt.setSchema(scene.schema);
    rt.reset();
    rt.play();
  }, [selectedSceneId]);

  // ── Playback controls ──────────────────────────────────────
  const handlePlay = useCallback(() => {
    const rt = runtimeRef.current;
    if (!rt) return;
    if (snapshot.status === "paused") {
      rt.resume();
    } else {
      rt.play();
    }
  }, [snapshot.status]);

  const handlePause = useCallback(() => {
    runtimeRef.current?.pause();
  }, []);

  const handleReset = useCallback(() => {
    runtimeRef.current?.reset();
  }, []);

  // ── JSON validation ────────────────────────────────────────
  const handleValidate = useCallback(() => {
    try {
      const parsed: unknown = JSON.parse(jsonInput);
      const result = validateSceneSchema(parsed);
      if (result.success) {
        setValidationResult({ ok: true, message: "Valid SceneSchema" });
      } else {
        setValidationResult({ ok: false, message: result.error });
      }
    } catch {
      setValidationResult({ ok: false, message: "Invalid JSON" });
    }
  }, [jsonInput]);

  // ── Selected scene interactions ────────────────────────────
  const selectedScene = MOCK_SCENES.find((s) => s.id === selectedSceneId);
  const interactions = selectedScene?.schema.interactions ?? [];

  // ── Runtime to pass to SceneCanvas ────────────────────────
  // We render the canvas only once runtime is available
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (runtimeRef.current) setReady(true);
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: "var(--color-neutral-950)",
        color: "var(--color-neutral-50)",
      }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "var(--color-neutral-800)" }}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold tracking-tight text-lg">
            AII Engine Playground
          </span>
          <span
            className="px-2 py-0.5 rounded text-xs font-mono font-semibold"
            style={{
              backgroundColor: "var(--color-accent)",
              color: "#fff",
            }}
          >
            DEV ONLY
          </span>
        </div>
        <span
          className="text-xs font-mono"
          style={{ color: "var(--color-fg-muted)" }}
        >
          Scene Runtime v1.0
        </span>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel ─────────────────────────────────────── */}
        <aside
          className="w-72 shrink-0 flex flex-col gap-6 p-5 border-r overflow-y-auto"
          style={{ borderColor: "var(--color-neutral-800)" }}
        >
          {/* Scene selector */}
          <section>
            <h2 className="text-xs font-mono font-semibold uppercase tracking-widest mb-3"
              style={{ color: "var(--color-neutral-400)" }}>
              Scene
            </h2>
            <select
              value={selectedSceneId}
              onChange={(e) => setSelectedSceneId(e.target.value)}
              className="w-full px-3 py-2 rounded text-sm font-mono border focus:outline-none"
              style={{
                backgroundColor: "var(--color-neutral-900)",
                color: "var(--color-neutral-50)",
                borderColor: "var(--color-neutral-700)",
              }}
            >
              {MOCK_SCENES.map((scene) => (
                <option key={scene.id} value={scene.id}>
                  {scene.name}
                </option>
              ))}
            </select>
            {selectedScene && (
              <p
                className="mt-2 text-xs leading-relaxed"
                style={{ color: "var(--color-neutral-400)" }}
              >
                {selectedScene.description}
              </p>
            )}
          </section>

          {/* Audio sliders */}
          <section>
            <h2 className="text-xs font-mono font-semibold uppercase tracking-widest mb-3"
              style={{ color: "var(--color-neutral-400)" }}>
              Audio Input
            </h2>
            <div className="flex flex-col gap-3">
              <AudioSlider label="Bass" value={bass} onChange={setBass} />
              <AudioSlider label="Mid" value={mid} onChange={setMid} />
              <AudioSlider label="Treble" value={treble} onChange={setTreble} />
              <AudioSlider label="Overall" value={overall} onChange={setOverall} />
            </div>
          </section>

          {/* JSON validator */}
          <section>
            <h2 className="text-xs font-mono font-semibold uppercase tracking-widest mb-3"
              style={{ color: "var(--color-neutral-400)" }}>
              Schema Validator
            </h2>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='Paste SceneSchema JSON here…'
              rows={8}
              className="w-full px-3 py-2 rounded text-xs font-mono border resize-y focus:outline-none"
              style={{
                backgroundColor: "var(--color-neutral-900)",
                color: "var(--color-neutral-50)",
                borderColor: "var(--color-neutral-700)",
              }}
            />
            <button
              onClick={handleValidate}
              className="mt-2 w-full py-1.5 rounded text-xs font-mono font-semibold transition-colors"
              style={{
                backgroundColor: "var(--color-neutral-800)",
                color: "var(--color-neutral-50)",
                border: "1px solid var(--color-neutral-700)",
              }}
            >
              Validate
            </button>
            {validationResult && (
              <div
                className="mt-2 px-3 py-2 rounded text-xs font-mono"
                style={{
                  backgroundColor: validationResult.ok
                    ? "rgba(34,197,94,0.1)"
                    : "rgba(228,73,66,0.1)",
                  color: validationResult.ok ? "#4ade80" : "var(--color-accent)",
                  border: `1px solid ${validationResult.ok ? "#4ade80" : "var(--color-accent)"}`,
                }}
              >
                {validationResult.ok ? "✓ " : "✗ "}
                {validationResult.message}
              </div>
            )}
          </section>
        </aside>

        {/* ── Right Panel ────────────────────────────────────── */}
        <main className="flex-1 flex flex-col">
          {/* Canvas */}
          <div className="flex-1 relative" style={{ minHeight: 0 }}>
            <div
              className="absolute inset-0 m-4 rounded overflow-hidden"
              style={{
                border: "1px solid var(--color-neutral-800)",
                aspectRatio: "16/9",
                maxHeight: "calc(100% - 2rem)",
                margin: "1rem auto",
                width: "auto",
              }}
            >
              {ready && runtimeRef.current && (
                <SceneCanvas
                  runtime={runtimeRef.current}
                  className="w-full h-full"
                />
              )}
            </div>
          </div>

          {/* Controls + Info */}
          <div
            className="border-t p-5 flex gap-8 flex-wrap"
            style={{ borderColor: "var(--color-neutral-800)" }}
          >
            {/* Playback controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePlay}
                disabled={isPlaying}
                className="px-4 py-2 rounded text-sm font-mono font-semibold disabled:opacity-40 transition-colors"
                style={{
                  backgroundColor: "var(--color-accent)",
                  color: "#fff",
                }}
              >
                Play
              </button>
              <button
                onClick={handlePause}
                disabled={!isPlaying}
                className="px-4 py-2 rounded text-sm font-mono font-semibold disabled:opacity-40 transition-colors"
                style={{
                  backgroundColor: "var(--color-neutral-800)",
                  color: "var(--color-neutral-50)",
                  border: "1px solid var(--color-neutral-700)",
                }}
              >
                Pause
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded text-sm font-mono font-semibold transition-colors"
                style={{
                  backgroundColor: "var(--color-neutral-800)",
                  color: "var(--color-neutral-50)",
                  border: "1px solid var(--color-neutral-700)",
                }}
              >
                Reset
              </button>
            </div>

            {/* Runtime info */}
            <div
              className="flex gap-6 items-center font-mono text-xs"
              style={{ color: "var(--color-neutral-400)" }}
            >
              <span>
                Status:{" "}
                <span style={{ color: "var(--color-neutral-50)" }}>
                  {snapshot.status}
                </span>
              </span>
              <span>
                FPS:{" "}
                <span
                  style={{
                    color:
                      snapshot.fps >= 50
                        ? "#4ade80"
                        : snapshot.fps >= 30
                        ? "#facc15"
                        : "var(--color-accent)",
                    fontWeight: 700,
                  }}
                >
                  {snapshot.fps}
                </span>
              </span>
              <span>
                Frame:{" "}
                <span style={{ color: "var(--color-neutral-50)" }}>
                  {snapshot.frameCount}
                </span>
              </span>
              <span>
                Render:{" "}
                <span style={{ color: "var(--color-neutral-50)" }}>
                  {snapshot.renderTimeMs}ms
                </span>
              </span>
              <span>
                Elapsed:{" "}
                <span style={{ color: "var(--color-neutral-50)" }}>
                  {(snapshot.elapsedMs / 1000).toFixed(2)}s
                </span>
              </span>
            </div>
          </div>

          {/* Interaction rules table */}
          {interactions.length > 0 && (
            <div
              className="border-t p-5"
              style={{ borderColor: "var(--color-neutral-800)" }}
            >
              <h2
                className="text-xs font-mono font-semibold uppercase tracking-widest mb-3"
                style={{ color: "var(--color-neutral-400)" }}
              >
                Interaction Rules ({interactions.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr style={{ color: "var(--color-neutral-500)" }}>
                      <th className="text-left pb-2 pr-4">Input</th>
                      <th className="text-left pb-2 pr-4">Output</th>
                      <th className="text-left pb-2 pr-4">Object</th>
                      <th className="text-left pb-2 pr-4">Range</th>
                      <th className="text-left pb-2 pr-4">Easing</th>
                      <th className="text-left pb-2">Smoothing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interactions.map((rule) => (
                      <tr
                        key={rule.id}
                        style={{
                          borderTop: "1px solid var(--color-neutral-800)",
                          color: "var(--color-neutral-300)",
                        }}
                      >
                        <td className="py-1.5 pr-4">
                          <span
                            className="px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: "rgba(228,73,66,0.15)",
                              color: "var(--color-accent)",
                            }}
                          >
                            {rule.input}
                          </span>
                        </td>
                        <td className="py-1.5 pr-4">→ {rule.output}</td>
                        <td className="py-1.5 pr-4" style={{ color: "var(--color-neutral-400)" }}>
                          {rule.objectId}
                        </td>
                        <td className="py-1.5 pr-4">
                          [{rule.outputMin}, {rule.outputMax}]
                        </td>
                        <td className="py-1.5 pr-4">{rule.easing}</td>
                        <td className="py-1.5">{rule.smoothing}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
