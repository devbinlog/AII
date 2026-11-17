"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ArtworkPermission } from "@/types";

interface ArtworkDetailClientProps {
  artworkId: string;
  initialLikeCount: number;
  initialIsLiked: boolean;
  permission: ArtworkPermission;
  isOwner: boolean;
  isAuthenticated: boolean;
  campaignSlug: string;
  artworkTitle: string;
}

type PermissionOption = ArtworkPermission;

export function ArtworkDetailClient({
  artworkId,
  initialLikeCount,
  initialIsLiked,
  permission: initialPermission,
  isOwner,
  isAuthenticated,
  campaignSlug,
  artworkTitle,
}: ArtworkDetailClientProps) {
  const router = useRouter();

  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [permission, setPermission] = useState<ArtworkPermission>(initialPermission);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [copied, setCopied] = useState(false);

  const [isLiking, startLikeTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isTogglingPermission, startPermissionTransition] = useTransition();
  const [isFlagging, startFlagTransition] = useTransition();

  const [error, setError] = useState<string | null>(null);

  // Like / Unlike
  const handleLike = () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/artworks/${artworkId}`);
      return;
    }
    startLikeTransition(async () => {
      const method = isLiked ? "DELETE" : "POST";
      const res = await fetch(`/api/artworks/${artworkId}/like`, { method, credentials: "include" });
      if (res.ok) {
        setIsLiked(!isLiked);
        setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
      }
    });
  };

  // Share
  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: do nothing
    }
  };

  // Visibility toggle
  const handlePermissionChange = (newPermission: PermissionOption) => {
    if (!isOwner) return;
    startPermissionTransition(async () => {
      const res = await fetch(`/api/artworks/${artworkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ permission: newPermission }),
      });
      if (res.ok) {
        setPermission(newPermission);
      } else {
        setError("Failed to update visibility");
      }
    });
  };

  // Delete
  const handleDelete = () => {
    startDeleteTransition(async () => {
      const res = await fetch(`/api/artworks/${artworkId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        router.push("/me/artworks");
      } else {
        setError("Failed to delete artwork");
        setShowDeleteConfirm(false);
      }
    });
  };

  // Flag
  const handleFlag = () => {
    if (!flagReason.trim()) return;
    startFlagTransition(async () => {
      const res = await fetch(`/api/artworks/${artworkId}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: flagReason }),
      });
      if (res.ok) {
        setShowFlagModal(false);
        setFlagReason("");
      } else {
        setError("Failed to submit flag report");
      }
    });
  };

  const permissionLabels: Record<ArtworkPermission, string> = {
    public: "Public",
    unlisted: "Unlisted",
    private: "Private",
  };

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="px-4 py-3 border border-[var(--color-accent)] text-sm text-[var(--color-accent)]"
        >
          {error}
        </div>
      )}

      {/* Like & Share */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleLike}
          disabled={isLiking}
          className={`flex items-center gap-2 px-4 py-2 border text-sm font-medium transition-all ${
            isLiked
              ? "border-[var(--color-accent)] text-[var(--color-accent)] bg-[rgba(228,73,66,0.08)]"
              : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-fg)]"
          }`}
          aria-label={isLiked ? "Unlike artwork" : "Like artwork"}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4"
            fill={isLiked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span className="font-mono">{likeCount}</span>
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] text-sm font-medium text-[var(--color-fg-muted)] hover:border-[var(--color-fg)] transition-all"
          aria-label="Copy link to share"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          {copied ? "Copied!" : "Share"}
        </button>

        {/* Flag (authenticated non-owners) */}
        {isAuthenticated && !isOwner && (
          <button
            onClick={() => setShowFlagModal(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 text-xs text-[var(--color-fg-subtle)] hover:text-[var(--color-accent)] transition-colors"
            aria-label="Report artwork"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
            Report
          </button>
        )}
      </div>

      {/* Owner controls */}
      {isOwner && (
        <div className="border border-[var(--color-border)] p-4 space-y-4">
          <p className="caption-label text-[var(--color-fg-subtle)]">Owner Controls</p>

          {/* Visibility */}
          <div>
            <p className="text-xs text-[var(--color-fg-muted)] mb-2">Visibility</p>
            <div className="flex gap-2">
              {(["public", "unlisted", "private"] as ArtworkPermission[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePermissionChange(p)}
                  disabled={isTogglingPermission || permission === p}
                  className={`px-3 py-1.5 text-xs font-medium border transition-all ${
                    permission === p
                      ? "border-[var(--color-fg)] bg-[var(--color-fg)] text-[var(--color-bg)]"
                      : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-fg-muted)]"
                  }`}
                >
                  {permissionLabels[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Edit & Delete */}
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--color-border)]">
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a href={`/campaigns/${campaignSlug}/create?artworkId=${artworkId}`}>
                Edit Artwork
              </a>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-[var(--color-accent)] hover:bg-[rgba(228,73,66,0.08)]"
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Flag Modal */}
      {showFlagModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
        >
          <div
            className="w-full max-w-md border border-[var(--color-border)] p-6 space-y-4"
            style={{ backgroundColor: "var(--color-bg)" }}
          >
            <div>
              <h3 className="font-semibold text-[var(--color-fg)] mb-1">Report Artwork</h3>
              <p className="text-sm text-[var(--color-fg-muted)]">
                &ldquo;{artworkTitle}&rdquo;
              </p>
            </div>
            <div>
              <label htmlFor="flag-reason" className="text-sm font-medium text-[var(--color-fg)] block mb-1.5">
                Reason <span className="text-[var(--color-accent)]">*</span>
              </label>
              <textarea
                id="flag-reason"
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                rows={3}
                placeholder="Describe why you're reporting this artwork..."
                className="w-full px-3 py-2 bg-transparent border border-[var(--color-border)] text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:border-[var(--color-fg)] resize-none"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowFlagModal(false); setFlagReason(""); }}
                disabled={isFlagging}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleFlag}
                disabled={isFlagging || !flagReason.trim()}
                loading={isFlagging}
              >
                Submit Report
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
        >
          <div
            className="w-full max-w-sm border border-[var(--color-border)] p-6 space-y-4"
            style={{ backgroundColor: "var(--color-bg)" }}
          >
            <div>
              <h3 className="font-semibold text-[var(--color-fg)] mb-1">Delete Artwork</h3>
              <p className="text-sm text-[var(--color-fg-muted)]">
                This action cannot be undone. &ldquo;{artworkTitle}&rdquo; will be permanently removed.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                loading={isDeleting}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
