"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FanArtwork, ArtworkPermission, ArtworkStatus } from "@/types/domain";

interface MyArtworksClientProps {
  initialArtworks: FanArtwork[];
  campaignSlugMap: Record<string, string>;
}

type TabFilter = "all" | "published" | "draft" | "saved";

const STATUS_LABEL: Record<ArtworkStatus, string> = {
  draft: "Draft",
  saved: "Saved",
  published: "Published",
  flagged: "Flagged",
  removed: "Removed",
};

const PERMISSION_LABEL: Record<ArtworkPermission, string> = {
  public: "Public",
  unlisted: "Unlisted",
  private: "Private",
};

export function MyArtworksClient({ initialArtworks, campaignSlugMap }: MyArtworksClientProps) {
  const router = useRouter();
  const [artworks, setArtworks] = useState(initialArtworks);
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtered = artworks.filter((a) => {
    if (activeTab === "all") return a.status !== "removed";
    if (activeTab === "draft") return a.status === "draft";
    if (activeTab === "saved") return a.status === "saved";
    if (activeTab === "published") return a.status === "published";
    return true;
  });

  const counts = {
    all: artworks.filter((a) => a.status !== "removed").length,
    draft: artworks.filter((a) => a.status === "draft").length,
    saved: artworks.filter((a) => a.status === "saved").length,
    published: artworks.filter((a) => a.status === "published").length,
  };

  const handleVisibilityChange = (artworkId: string, permission: ArtworkPermission) => {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/artworks/${artworkId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission }),
      });
      if (res.ok) {
        setArtworks((prev) =>
          prev.map((a) => (a.id === artworkId ? { ...a, permission } : a))
        );
      } else {
        setError("Failed to update visibility.");
      }
    });
  };

  const handleDelete = (artworkId: string) => {
    setDeletingId(artworkId);
  };

  const confirmDelete = (artworkId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/artworks/${artworkId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setArtworks((prev) => prev.filter((a) => a.id !== artworkId));
        setDeletingId(null);
        router.refresh();
      } else {
        setError("Failed to delete artwork.");
        setDeletingId(null);
      }
    });
  };

  const tabs: TabFilter[] = ["all", "published", "saved", "draft"];

  return (
    <div>
      {/* Tab bar */}
      <div
        className="flex items-center gap-1 mb-8 border-b overflow-x-auto"
        style={{ borderColor: "var(--color-neutral-800)" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium capitalize transition-colors"
            style={{
              color: activeTab === tab ? "var(--color-neutral-50)" : "var(--color-neutral-500)",
              borderBottom: activeTab === tab ? "2px solid var(--color-accent)" : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >
            {tab === "all" ? "All" : STATUS_LABEL[tab as ArtworkStatus]}
            <span
              className="ml-2 text-xs px-1.5 py-0.5 rounded-full font-mono"
              style={{ backgroundColor: "var(--color-neutral-900)", color: "var(--color-neutral-400)" }}
            >
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div
          className="mb-6 px-4 py-3 rounded text-sm"
          style={{ backgroundColor: "rgba(228,73,66,0.1)", border: "1px solid rgba(228,73,66,0.3)", color: "var(--color-accent)" }}
        >
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-center py-16 text-sm" style={{ color: "var(--color-neutral-500)" }}>
          No artworks in this category.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((artwork) => (
            <ArtworkCard
              key={artwork.id}
              artwork={artwork}
              campaignSlug={campaignSlugMap[artwork.campaignId] ?? ""}
              onVisibilityChange={handleVisibilityChange}
              onDelete={handleDelete}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div
            className="w-full max-w-sm rounded-xl p-6"
            style={{ backgroundColor: "var(--color-neutral-900)", border: "1px solid var(--color-neutral-800)" }}
          >
            <h3 className="text-lg font-bold mb-2" style={{ color: "var(--color-neutral-50)" }}>
              Delete artwork?
            </h3>
            <p className="text-sm mb-6" style={{ color: "var(--color-neutral-400)" }}>
              This action cannot be undone. The artwork will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 px-4 py-2 rounded text-sm font-medium"
                style={{ backgroundColor: "var(--color-neutral-800)", color: "var(--color-neutral-200)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(deletingId)}
                disabled={isPending}
                className="flex-1 px-4 py-2 rounded text-sm font-semibold"
                style={{ backgroundColor: "var(--color-accent)", color: "#fff", opacity: isPending ? 0.6 : 1 }}
              >
                {isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Artwork Card
// ============================================================

interface ArtworkCardProps {
  artwork: FanArtwork;
  campaignSlug: string;
  onVisibilityChange: (id: string, permission: ArtworkPermission) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
}

function ArtworkCard({ artwork, campaignSlug, onVisibilityChange, onDelete, isPending }: ArtworkCardProps) {
  const [showPermMenu, setShowPermMenu] = useState(false);

  const statusColor: Record<ArtworkStatus, string> = {
    draft: "var(--color-neutral-500)",
    saved: "#3b82f6",
    published: "#22c55e",
    flagged: "#f59e0b",
    removed: "var(--color-accent)",
  };

  const permissions: ArtworkPermission[] = ["public", "unlisted", "private"];

  return (
    <article
      className="rounded-xl overflow-hidden flex flex-col"
      style={{ backgroundColor: "var(--color-neutral-900)", border: "1px solid var(--color-neutral-800)" }}
    >
      {/* Canvas placeholder (no real image for mock data) */}
      <div
        className="aspect-square flex items-center justify-center relative"
        style={{ backgroundColor: "var(--color-neutral-950)" }}
      >
        {artwork.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artwork.imageUrl} alt={artwork.title} className="w-full h-full object-cover" />
        ) : (
          <div className="text-center">
            <div
              className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center"
              style={{ backgroundColor: "var(--color-neutral-800)" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6" style={{ color: "var(--color-neutral-600)" }}>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
            <p className="text-xs" style={{ color: "var(--color-neutral-600)" }}>No preview</p>
          </div>
        )}

        {/* Status badge */}
        <span
          className="absolute top-3 left-3 font-mono text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
          style={{ backgroundColor: "rgba(0,0,0,0.75)", color: statusColor[artwork.status] }}
        >
          {STATUS_LABEL[artwork.status]}
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-3 p-4 flex-1">
        <div>
          <h3 className="font-semibold text-sm leading-tight mb-1" style={{ color: "var(--color-neutral-50)" }}>
            {artwork.title}
          </h3>
          <p className="text-xs" style={{ color: "var(--color-neutral-500)" }}>
            {new Date(artwork.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {" · "}
            {artwork.likeCount} like{artwork.likeCount !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto pt-2 border-t" style={{ borderColor: "var(--color-neutral-800)" }}>
          {/* View */}
          <Link
            href={`/artworks/${artwork.id}`}
            className="flex-1 text-center text-xs font-medium py-2 rounded transition-colors"
            style={{ backgroundColor: "var(--color-neutral-800)", color: "var(--color-neutral-200)" }}
          >
            View
          </Link>

          {/* Edit (re-enter creator) */}
          {campaignSlug && (
            <Link
              href={`/campaigns/${campaignSlug}/create`}
              className="flex-1 text-center text-xs font-medium py-2 rounded transition-colors"
              style={{ backgroundColor: "var(--color-neutral-800)", color: "var(--color-neutral-200)" }}
            >
              Edit
            </Link>
          )}

          {/* Visibility */}
          <div className="relative">
            <button
              onClick={() => setShowPermMenu((v) => !v)}
              disabled={isPending}
              className="text-xs font-medium py-2 px-3 rounded transition-colors"
              style={{ backgroundColor: "var(--color-neutral-800)", color: "var(--color-neutral-400)" }}
              title="Change visibility"
            >
              {PERMISSION_LABEL[artwork.permission]}
            </button>
            {showPermMenu && (
              <div
                className="absolute bottom-full right-0 mb-1 rounded-lg shadow-xl z-10 overflow-hidden"
                style={{ backgroundColor: "var(--color-neutral-800)", border: "1px solid var(--color-neutral-700)", minWidth: "120px" }}
              >
                {permissions.map((perm) => (
                  <button
                    key={perm}
                    onClick={() => {
                      onVisibilityChange(artwork.id, perm);
                      setShowPermMenu(false);
                    }}
                    className="w-full text-left text-xs px-3 py-2 transition-colors"
                    style={{
                      color: artwork.permission === perm ? "var(--color-accent)" : "var(--color-neutral-200)",
                      backgroundColor: artwork.permission === perm ? "rgba(228,73,66,0.08)" : "transparent",
                    }}
                  >
                    {PERMISSION_LABEL[perm]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Delete */}
          <button
            onClick={() => onDelete(artwork.id)}
            disabled={isPending}
            className="p-2 rounded transition-colors"
            style={{ backgroundColor: "var(--color-neutral-800)", color: "var(--color-neutral-500)" }}
            title="Delete artwork"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
              <path d="M6 4v1H3v1.5h14V5h-3V4a1 1 0 00-1-1H7a1 1 0 00-1 1zm1 0h6v1H7V4zM4.5 7.5L5.5 17h9l1-9.5H4.5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}
