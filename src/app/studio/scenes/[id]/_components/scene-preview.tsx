"use client";

import { useEffect, useRef, useState } from "react";
import { SceneRuntime } from "@/lib/engine/runtime/scene-runtime";
import { SceneCanvas } from "@/components/engine/scene-canvas";
import { createMockAudioFrame, simulateAudioFrame } from "@/lib/engine/audio/mock-frame";
import type { SceneSchema } from "@/types";

export interface ManualAudio {
  bass: number;
  mid: number;
  treble: number;
}

/**
 * Live preview using the WS-04 SceneRuntime + Canvas2D renderer.
 * Audio is simulated (DEMO) or driven by the manual sliders.
 */
export function ScenePreview({ schema, manualAudio }: { schema: SceneSchema; manualAudio: ManualAudio | null }) {
  const [runtime] = useState(() => new SceneRuntime(42));
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const manualRef = useRef<ManualAudio | null>(manualAudio);
  manualRef.current = manualAudio;
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    runtime.setMockAudioFn((ms) => {
      const m = manualRef.current;
      return m ? createMockAudioFrame(m, ms) : simulateAudioFrame(ms);
    });
    const offs = [
      runtime.on("play", () => setPlaying(true)),
      runtime.on("resume", () => setPlaying(true)),
      runtime.on("pause", () => setPlaying(false)),
      runtime.on("reset", () => setPlaying(false)),
      runtime.on("ended", () => setPlaying(false)),
    ];
    const poll = setInterval(() => setElapsed(runtime.getSnapshot().elapsedMs), 200);
    return () => {
      offs.forEach((off) => off());
      clearInterval(poll);
      // Stop the RAF loop; SceneCanvas owns and disposes the renderer.
      if (runtime.getSnapshot().status === "playing") runtime.pause();
    };
  }, [runtime]);

  // Resizing a canvas clears it; while paused nothing redraws, so render a still frame.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    let raf = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (runtime.getSnapshot().status !== "playing") runtime.reset();
      });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [runtime]);

  // Apply every schema edit to the preview; keep playing if it was playing.
  useEffect(() => {
    runtime.setSchema(schema);
    if (runtime.getSnapshot().status !== "playing") runtime.reset();
  }, [runtime, schema]);

  const toggle = () => {
    const status = runtime.getSnapshot().status;
    if (status === "playing") runtime.pause();
    else if (status === "paused") runtime.resume();
    else runtime.play();
  };

  const seconds = (elapsed / 1000).toFixed(1);
  const total = schema.duration ? (schema.duration / 1000).toFixed(1) : "∞";

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={frameRef}
        className="relative w-full border border-[var(--color-border)] bg-black overflow-hidden"
        style={{ aspectRatio: `${schema.canvasWidth} / ${schema.canvasHeight}`, maxHeight: "62vh" }}
      >
        <SceneCanvas runtime={runtime} className="absolute inset-0 h-full w-full" />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button type="button" onClick={toggle} className="h-8 px-3 border border-[var(--color-border-strong)] hover:border-[var(--color-fg)] font-medium">
          {playing ? "Pause" : "Play"}
        </button>
        <button type="button" onClick={() => runtime.reset()} className="h-8 px-3 border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
          Reset
        </button>
        <span className="font-mono text-[var(--color-fg-muted)] tabular-nums" aria-live="off">
          {seconds}s / {total}s
        </span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-[rgba(228,73,66,0.8)]">
          {manualAudio ? "Manual audio" : "Simulated audio"}
        </span>
      </div>
    </div>
  );
}
