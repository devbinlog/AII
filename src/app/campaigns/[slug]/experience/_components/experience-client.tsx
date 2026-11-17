"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  Component,
} from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SceneRuntime } from "@/lib/engine/runtime/scene-runtime";
import { SceneCanvas } from "@/components/engine/scene-canvas";
import { simulateAudioFrame } from "@/lib/engine/audio/mock-frame";
import type { ExperienceVersion, ExperienceScene, SceneSchema } from "@/types/domain";
import type { RuntimeSnapshot } from "@/lib/engine/types";
import { ExperienceHud } from "./experience-hud";

// ============================================================
// Types
// ============================================================

export interface ExperienceClientProps {
  slug: string;
  experienceTitle: string;
  experienceVersion: ExperienceVersion;
}

// ============================================================
// Error Boundary
// ============================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error) => void;
  slug: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ExperienceErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <ExperienceErrorUI
          message={this.state.error?.message ?? "Unknown error"}
          slug={this.props.slug}
        />
      );
    }
    return this.props.children;
  }
}

// ============================================================
// Error UI
// ============================================================

function ExperienceErrorUI({ message, slug }: { message: string; slug: string }) {
  const router = useRouter();
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen gap-6"
      style={{
        backgroundColor: "var(--color-neutral-950)",
        color: "var(--color-neutral-50)",
      }}
    >
      <div className="text-center max-w-md px-6">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: "rgba(228,73,66,0.15)", border: "1px solid rgba(228,73,66,0.4)" }}
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-6 h-6"
          >
            <path d="M10 3v7m0 4v.5" />
            <circle cx="10" cy="10" r="8" />
          </svg>
        </div>
        <h2
          className="text-xl font-semibold mb-2"
          style={{ color: "var(--color-neutral-50)" }}
        >
          Scene load failed
        </h2>
        <p
          className="text-sm font-mono mb-6 leading-relaxed"
          style={{ color: "var(--color-neutral-400)" }}
        >
          {message}
        </p>
        <button
          type="button"
          onClick={() => router.push(`/campaigns/${slug}`)}
          className="px-5 py-2.5 text-sm font-medium rounded transition-opacity hover:opacity-80"
          style={{
            backgroundColor: "var(--color-neutral-800)",
            color: "var(--color-neutral-50)",
            border: "1px solid var(--color-neutral-700)",
          }}
        >
          ← Go back
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Scene transition overlay
// ============================================================

function SceneTransitionOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      className="absolute inset-0 z-30 pointer-events-none"
      style={{
        backgroundColor: "var(--color-neutral-950)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.4s ease",
      }}
      aria-hidden="true"
    />
  );
}

// ============================================================
// Helpers
// ============================================================

/** Sort ExperienceScene array by order field */
function getSortedScenes(version: ExperienceVersion): ExperienceScene[] {
  return [...version.snapshot.scenes].sort((a, b) => a.order - b.order);
}

// ============================================================
// ExperienceClient (main)
// ============================================================

export function ExperienceClient({
  slug,
  experienceTitle,
  experienceVersion,
}: ExperienceClientProps) {
  // ── Scenes ──────────────────────────────────────────────
  const sortedScenes = getSortedScenes(experienceVersion);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  // ── Playback state ───────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false); // user clicked Play at least once

  // ── Fullscreen state ─────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Reduced motion ───────────────────────────────────────
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Runtime ──────────────────────────────────────────────
  const runtimeRef = useRef<SceneRuntime | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot>({
    status: "idle",
    elapsedMs: 0,
    currentSceneIndex: 0,
    frameCount: 0,
    fps: 0,
    renderTimeMs: 0,
  });

  // Initialize runtime once
  useEffect(() => {
    const rt = new SceneRuntime(42);

    // Attach simulated audio — keyed to elapsed time
    rt.setMockAudioFn((elapsedMs: number) => simulateAudioFrame(elapsedMs));

    // Sync play/pause UI state from engine events
    const unsubs = [
      rt.on("play", () => setIsPlaying(true)),
      rt.on("resume", () => setIsPlaying(true)),
      rt.on("pause", () => setIsPlaying(false)),
      rt.on("reset", () => setIsPlaying(false)),
      rt.on("ended", () => setIsPlaying(false)),
    ];

    runtimeRef.current = rt;
    setRuntimeReady(true);

    return () => {
      unsubs.forEach((fn) => fn());
      rt.dispose();
    };
  }, []);

  // ── Load scene schema when sceneIndex changes ────────────
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt) return;

    const sceneEntry = sortedScenes[sceneIndex];
    if (!sceneEntry) return;

    const schema: SceneSchema | undefined =
      experienceVersion.snapshot.sceneSchemas[sceneEntry.sceneId];

    if (!schema) {
      // Schema not found — leave runtime in current state
      return;
    }

    rt.setSchema(schema);
    rt.reset();

    // Only auto-play if user has already pressed play
    if (hasStarted) {
      rt.play();
    }
  }, [sceneIndex, runtimeRef, experienceVersion, hasStarted]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Snapshot polling (100ms) ─────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (runtimeRef.current) {
        setSnapshot(runtimeRef.current.getSnapshot());
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  // ── Scene duration auto-advance ──────────────────────────
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt) return;
    const unsubEnded = rt.on("ended", () => {
      const nextIndex = sceneIndex + 1;
      if (nextIndex < sortedScenes.length) {
        const transitionMs =
          sortedScenes[sceneIndex]?.transitionDuration ?? 400;
        setTransitioning(true);
        setTimeout(() => {
          setSceneIndex(nextIndex);
          setTransitioning(false);
        }, reducedMotion ? 0 : transitionMs);
      }
    });
    return () => unsubEnded();
  }, [sceneIndex, sortedScenes, reducedMotion, runtimeRef]);

  // ── Fullscreen sync ──────────────────────────────────────
  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // ── Handlers ─────────────────────────────────────────────
  const handlePlayPause = useCallback(() => {
    const rt = runtimeRef.current;
    if (!rt) return;

    if (!hasStarted) {
      setHasStarted(true);
      rt.play();
      return;
    }

    const status = rt.getSnapshot().status;
    if (status === "playing") {
      rt.pause();
    } else if (status === "paused") {
      rt.resume();
    } else {
      // idle or ended
      rt.play();
    }
  }, [hasStarted]);

  const handleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      el.requestFullscreen().catch(() => undefined);
    }
  }, []);

  const handleNextScene = useCallback(() => {
    const nextIndex = sceneIndex + 1;
    if (nextIndex >= sortedScenes.length) return;
    const transitionMs =
      sortedScenes[sceneIndex]?.transitionDuration ?? 400;
    setTransitioning(true);
    setTimeout(
      () => {
        setSceneIndex(nextIndex);
        setTransitioning(false);
      },
      reducedMotion ? 0 : transitionMs
    );
  }, [sceneIndex, sortedScenes, reducedMotion]);

  // ── Render ───────────────────────────────────────────────
  const hasMultipleScenes = sortedScenes.length > 1;

  return (
    <ExperienceErrorBoundary slug={slug}>
      {/* Full-viewport immersive container */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden"
        style={{
          backgroundColor: "var(--color-neutral-950)",
          // Occupy the full viewport minus the navbar (56px from pt-14 in layout)
          minHeight: "calc(100vh - 56px)",
        }}
      >
        {/* ── 16:9 Canvas area ─────────────────────────────── */}
        <div
          className="relative flex items-center justify-center w-full"
          style={{ minHeight: "calc(100vh - 56px)" }}
        >
          <div
            className="relative w-full"
            style={{
              // Maintain 16:9 but fill available space
              maxWidth: "calc((100vh - 56px) * (16/9))",
              aspectRatio: "16 / 9",
              backgroundColor: "#000",
            }}
          >
            {/* Canvas */}
            {runtimeReady && runtimeRef.current && (
              <SceneCanvas
                runtime={runtimeRef.current}
                className="absolute inset-0 w-full h-full"
              />
            )}

            {/* Scene transition fade overlay */}
            <SceneTransitionOverlay visible={transitioning} />

            {/* HUD overlay */}
            {runtimeReady && (
              <ExperienceHud
                isPlaying={isPlaying}
                fps={snapshot.fps}
                onPlayPause={handlePlayPause}
                onFullscreen={handleFullscreen}
                isFullscreen={isFullscreen}
                reducedMotion={reducedMotion}
              />
            )}

            {/* ── Pre-play overlay ─────────────────────────── */}
            {!hasStarted && (
              <div
                className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6"
                style={{ backgroundColor: "rgba(10,10,10,0.75)" }}
              >
                <div className="text-center px-6">
                  <p
                    className="text-xs font-mono uppercase tracking-widest mb-3"
                    style={{ color: "var(--color-neutral-400)" }}
                  >
                    Interactive Experience
                  </p>
                  <h1
                    className="text-2xl font-semibold mb-2"
                    style={{ color: "var(--color-neutral-50)" }}
                  >
                    {experienceTitle}
                  </h1>
                  <p
                    className="text-xs font-mono mb-8"
                    style={{ color: "var(--color-accent)" }}
                  >
                    DEMO MODE — Simulated Audio
                  </p>
                  <button
                    type="button"
                    onClick={handlePlayPause}
                    className="flex items-center gap-3 px-8 py-4 rounded-full text-sm font-semibold transition-opacity hover:opacity-80 mx-auto"
                    style={{
                      backgroundColor: "var(--color-accent)",
                      color: "#fff",
                    }}
                  >
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-5 h-5 ml-0.5"
                      aria-hidden="true"
                    >
                      <path d="M6.5 4.5a.5.5 0 0 1 .75-.43l9 5a.5.5 0 0 1 0 .86l-9 5A.5.5 0 0 1 6.5 14.5v-10z" />
                    </svg>
                    Start Experience
                  </button>
                  <p
                    className="mt-4 text-xs"
                    style={{ color: "var(--color-neutral-600)" }}
                  >
                    Press Space to play/pause · F for fullscreen
                  </p>
                </div>
              </div>
            )}

            {/* ── Scene nav & Create Artwork (bottom bar) ───
                 pr-36 keeps the CTA clear of the HUD play/fullscreen controls (bottom-right). */}
            {hasStarted && (
              <div
                className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between gap-3 pl-4 pr-36 py-3"
                style={{
                  background:
                    "linear-gradient(to top, rgba(10,10,10,0.85) 0%, transparent 100%)",
                }}
              >
                {/* Scene indicators */}
                {hasMultipleScenes && (
                  <div className="flex items-center gap-1.5" aria-label="Scene navigation">
                    {sortedScenes.map((s, i) => (
                      <button
                        key={s.sceneId}
                        type="button"
                        onClick={() => {
                          if (i !== sceneIndex) {
                            setTransitioning(true);
                            setTimeout(
                              () => {
                                setSceneIndex(i);
                                setTransitioning(false);
                              },
                              reducedMotion ? 0 : 300
                            );
                          }
                        }}
                        aria-label={`Go to scene ${i + 1}`}
                        aria-current={i === sceneIndex ? "true" : undefined}
                        className="rounded-full transition-all"
                        style={{
                          width: i === sceneIndex ? 24 : 8,
                          height: 8,
                          backgroundColor:
                            i === sceneIndex
                              ? "var(--color-accent)"
                              : "rgba(255,255,255,0.3)",
                          transition: reducedMotion
                            ? "none"
                            : "width 0.3s ease, background-color 0.2s ease",
                        }}
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  {/* Next scene */}
                  {hasMultipleScenes && sceneIndex < sortedScenes.length - 1 && (
                    <button
                      type="button"
                      onClick={handleNextScene}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded transition-opacity hover:opacity-80"
                      style={{
                        backgroundColor: "rgba(0,0,0,0.55)",
                        color: "var(--color-neutral-50)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      Next scene
                      <svg
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-3 h-3"
                        aria-hidden="true"
                      >
                        <path d="M2 6h8M7 3l3 3-3 3" />
                      </svg>
                    </button>
                  )}

                  {/* Create Artwork CTA */}
                  <Link
                    href={`/campaigns/${slug}/create`}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor: "var(--color-accent)",
                      color: "#fff",
                    }}
                  >
                    Create Artwork
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Reduced-motion notice ─────────────────────────── */}
        {reducedMotion && (
          <div
            className="absolute top-4 right-4 z-20 px-3 py-1.5 text-xs font-mono rounded"
            style={{
              backgroundColor: "rgba(0,0,0,0.55)",
              color: "var(--color-neutral-400)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            Reduced motion: animations disabled
          </div>
        )}
      </div>
    </ExperienceErrorBoundary>
  );
}
