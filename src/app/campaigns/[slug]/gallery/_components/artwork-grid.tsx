import type { FanArtwork } from "@/types";
import { ArtworkCard } from "./artwork-card";

interface ArtworkGridProps {
  artworks: FanArtwork[];
  accentColor: string;
}

export function ArtworkGrid({ artworks, accentColor }: ArtworkGridProps) {
  if (artworks.length === 0) {
    return (
      <div
        className="border py-24 text-center"
        style={{ borderColor: "var(--color-neutral-800)" }}
        role="status"
        aria-live="polite"
      >
        <svg
          viewBox="0 0 48 48"
          className="w-12 h-12 mx-auto mb-4 opacity-20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          aria-hidden="true"
          style={{ color: "var(--color-neutral-400)" }}
        >
          <rect x="6" y="6" width="16" height="16" rx="1" />
          <rect x="26" y="6" width="16" height="16" rx="1" />
          <rect x="6" y="26" width="16" height="16" rx="1" />
          <rect x="26" y="26" width="16" height="16" rx="1" />
        </svg>
        <p
          className="text-base"
          style={{ color: "var(--color-neutral-400)" }}
        >
          No artworks yet. Be the first to create one!
        </p>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
      aria-label={`${artworks.length} artworks`}
    >
      {artworks.map((artwork) => (
        <ArtworkCard
          key={artwork.id}
          artwork={artwork}
          accentColor={accentColor}
        />
      ))}
    </div>
  );
}
