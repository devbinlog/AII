"use client";

import { useEffect } from "react";

// ============================================================
// Types
// ============================================================

interface ExperienceHudProps {
  isPlaying: boolean;
  fps: number;
  onPlayPause: () => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
  reducedMotion: boolean;
}

// ============================================================
// ExperienceHud
// ============================================================

/**
 * Minimal immersive HUD overlay.
 * Keyboard: Space = play/pause, F = fullscreen, Escape = exit fullscreen.
 * FPS counter shown only in development.
 */
export function ExperienceHud({
  isPlaying,
  fps,
  onPlayPause,
  onFullscreen,
  isFullscreen,
  reducedMotion,
}: ExperienceHudProps) {
  // ── Keyboard bindings ──────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Don't intercept when focus is in an input / textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.code === "Space") {
        e.preventDefault();
        onPlayPause();
      } else if (e.code === "KeyF") {
        e.preventDefault();
        onFullscreen();
      }
      // Escape is handled natively by the browser to exit fullscreen;
      // no need to intercept it here.
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onPlayPause, onFullscreen]);

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <>
      {/* ── Top-left: Demo Mode badge ─────────────────────── */}
      <div
        className="absolute top-4 left-4 flex items-center gap-2 z-20"
        aria-live="polite"
      >
        <span
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-semibold rounded-sm"
          style={{
            backgroundColor: "rgba(232,25,44,0.15)",
            color: "var(--color-accent)",
            border: "1px solid rgba(232,25,44,0.35)",
            backdropFilter: "blur(4px)",
          }}
        >
          {/* Pulsing dot — suppressed if reducedMotion */}
          <span
            className={reducedMotion ? "block" : "block animate-pulse"}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: "var(--color-accent)",
              flexShrink: 0,
            }}
            aria-hidden="true"
          />
          DEMO MODE — Simulated Audio
        </span>

        {/* FPS — dev only */}
        {isDev && (
          <span
            className="px-2 py-1 text-xs font-mono rounded-sm"
            style={{
              backgroundColor: "rgba(0,0,0,0.55)",
              color:
                fps >= 50
                  ? "#4ade80"
                  : fps >= 30
                  ? "#facc15"
                  : "var(--color-accent)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(4px)",
            }}
            aria-label={`${fps} frames per second`}
          >
            {fps} FPS
          </span>
        )}
      </div>

      {/* ── Bottom-right: Playback & Fullscreen controls ──── */}
      <div
        className="absolute bottom-6 right-6 flex items-center gap-3 z-20"
        role="toolbar"
        aria-label="Playback controls"
      >
        {/* Play / Pause */}
        <button
          type="button"
          onClick={onPlayPause}
          aria-label={isPlaying ? "Pause (Space)" : "Play (Space)"}
          className="flex items-center justify-center rounded-full transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          style={{
            width: 48,
            height: 48,
            backgroundColor: "var(--color-accent)",
            color: "#fff",
            flexShrink: 0,
          }}
        >
          {isPlaying ? (
            // Pause icon
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
              aria-hidden="true"
            >
              <rect x="5" y="4" width="3" height="12" rx="1" />
              <rect x="12" y="4" width="3" height="12" rx="1" />
            </svg>
          ) : (
            // Play icon
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5 ml-0.5"
              aria-hidden="true"
            >
              <path d="M6.5 4.5a.5.5 0 0 1 .75-.43l9 5a.5.5 0 0 1 0 .86l-9 5A.5.5 0 0 1 6.5 14.5v-10z" />
            </svg>
          )}
        </button>

        {/* Fullscreen toggle */}
        <button
          type="button"
          onClick={onFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen (F)" : "Enter fullscreen (F)"}
          className="flex items-center justify-center rounded transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          style={{
            width: 40,
            height: 40,
            backgroundColor: "rgba(0,0,0,0.55)",
            color: "var(--color-neutral-50)",
            border: "1px solid rgba(255,255,255,0.15)",
            backdropFilter: "blur(4px)",
            flexShrink: 0,
          }}
        >
          {isFullscreen ? (
            // Compress icon
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <path d="M12 8h4M12 8V4M12 8l5-5M8 12H4m4 0v4m0-4-5 5" />
            </svg>
          ) : (
            // Expand icon
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <path d="M3 8V3h5M3 3l5 5M17 12v5h-5m5 0-5-5" />
            </svg>
          )}
        </button>
      </div>
    </>
  );
}
