"use client";

import { useState } from "react";
import Link from "next/link";
import type { FanArtwork } from "@/types";
import { formatRelativeTime, formatCount } from "@/lib/utils/format";

interface ArtworkCardProps {
  artwork: FanArtwork;
  creatorName?: string;
  accentColor: string;
}

function ArtworkVisualPlaceholder({
  artworkId,
  accentColor,
}: {
  artworkId: string;
  accentColor: string;
}) {
  // Deterministic pattern from artwork id
  const seed = artworkId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const cx = 60 + (seed % 80);
  const cy = 60 + ((seed * 7) % 80);
  const r1 = 40 + (seed % 30);

  return (
    <div
      className="aspect-square relative overflow-hidden w-full"
      style={{ backgroundColor: "#111111" }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#111111" />
        <circle cx={cx} cy={cy} r={r1} fill="none" stroke={accentColor} strokeWidth="0.5" opacity="0.35" />
        <circle cx={200 - cx} cy={200 - cy} r={r1 * 0.6} fill={accentColor} opacity="0.06" />
        <line x1="0" y1={cy} x2="200" y2={200 - cy} stroke={accentColor} strokeWidth="0.5" opacity="0.1" />
        <line x1={cx} y1="0" x2={200 - cx} y2="200" stroke={accentColor} strokeWidth="0.5" opacity="0.1" />
        <rect
          x={cx - 20}
          y={cy - 20}
          width="40"
          height="40"
          fill="none"
          stroke={accentColor}
          strokeWidth="0.5"
          opacity="0.2"
          transform={`rotate(${seed % 45}, ${cx}, ${cy})`}
        />
      </svg>
    </div>
  );
}

export function ArtworkCard({ artwork, creatorName, accentColor }: ArtworkCardProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(artwork.likeCount);
  const [isLoading, setIsLoading] = useState(false);

  async function handleLike() {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const method = liked ? "DELETE" : "POST";
      const res = await fetch(`/api/artworks/${artwork.id}/like`, { method });
      if (res.ok) {
        setLiked((prev) => !prev);
        setLikeCount((prev) => prev + (liked ? -1 : 1));
      }
    } catch {
      // silently fail — user may not be logged in
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <article
      className="group flex flex-col"
      style={{ backgroundColor: "var(--color-neutral-900)" }}
    >
      {/* Image area */}
      <Link
        href={`/artworks/${artwork.id}`}
        className="block relative overflow-hidden"
        aria-label={`View artwork: ${artwork.title}`}
      >
        <ArtworkVisualPlaceholder artworkId={artwork.id} accentColor={accentColor} />
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-7 h-7"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </Link>

      {/* Card body */}
      <div
        className="flex-1 p-3 border-t"
        style={{ borderColor: "var(--color-neutral-800)" }}
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <Link
            href={`/artworks/${artwork.id}`}
            className="font-medium text-sm leading-tight hover:opacity-70 transition-opacity flex-1 min-w-0 truncate"
            style={{ color: "var(--color-neutral-50)" }}
          >
            {artwork.title}
          </Link>
          {/* Like button */}
          <button
            type="button"
            onClick={handleLike}
            disabled={isLoading}
            className="flex items-center gap-1 shrink-0 transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ color: liked ? accentColor : "var(--color-neutral-400)" }}
            aria-label={liked ? `Unlike artwork (${likeCount} likes)` : `Like artwork (${likeCount} likes)`}
            aria-pressed={liked}
          >
            <svg
              viewBox="0 0 16 16"
              className="w-3.5 h-3.5"
              fill={liked ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M8 13.6C7 12.8 2 9.2 2 5.8a3.2 3.2 0 016-1.5 3.2 3.2 0 016 1.5C14 9.2 9 12.8 8 13.6z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-xs font-mono">{formatCount(likeCount)}</span>
          </button>
        </div>

        {/* Creator + date */}
        <div className="flex items-center justify-between gap-2">
          <p
            className="text-xs truncate"
            style={{ color: "var(--color-neutral-400)" }}
          >
            {creatorName ?? "Anonymous"}
          </p>
          <time
            className="text-xs shrink-0 font-mono"
            dateTime={artwork.createdAt}
            style={{ color: "var(--color-neutral-400)" }}
          >
            {formatRelativeTime(artwork.createdAt)}
          </time>
        </div>
      </div>
    </article>
  );
}
