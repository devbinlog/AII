export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getRepository } from "@/lib/repository";
import { getSession } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { formatCount, formatDate } from "@/lib/utils/format";
import { ArtworkDetailClient } from "./_components/artwork-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const repo = getRepository();
  const artwork = await repo.artwork.findById(id);
  if (!artwork) return { title: "Artwork Not Found" };
  return {
    title: artwork.title,
    description: `Fan artwork: ${artwork.title}`,
  };
}

function ArtworkPlaceholder({ title, color = "#e8192c" }: { title: string; color?: string }) {
  return (
    <div
      className="w-full aspect-video relative overflow-hidden flex items-center justify-center"
      style={{ backgroundColor: "#0a0a0a" }}
      aria-label={`Artwork placeholder for: ${title}`}
    >
      <svg
        viewBox="0 0 1920 1080"
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="1920" height="1080" fill="#0a0a0a" />
        {Array.from({ length: 16 }).map((_, i) => (
          <line
            key={`v-${i}`}
            x1={i * 120}
            y1="0"
            x2={i * 120}
            y2="1080"
            stroke={color}
            strokeWidth="0.5"
            opacity={0.08}
          />
        ))}
        {Array.from({ length: 9 }).map((_, i) => (
          <line
            key={`h-${i}`}
            x1="0"
            y1={i * 120}
            x2="1920"
            y2={i * 120}
            stroke={color}
            strokeWidth="0.5"
            opacity={0.08}
          />
        ))}
        <circle cx="960" cy="540" r="300" fill="none" stroke={color} strokeWidth="0.5" opacity="0.2" />
        <circle cx="960" cy="540" r="200" fill="none" stroke={color} strokeWidth="0.5" opacity="0.15" />
        <circle cx="960" cy="540" r="100" fill={color} opacity="0.06" />
      </svg>
      <div className="relative z-10 text-center px-8 max-w-lg">
        <p className="caption-label mb-3" style={{ color: `${color}99` }}>
          Fan Artwork
        </p>
        <h2
          className="heading-display text-4xl md:text-6xl"
          style={{ color: "#f5f5f0", lineHeight: 1 }}
        >
          {title}
        </h2>
      </div>
    </div>
  );
}

export default async function ArtworkDetailPage({ params }: PageProps) {
  const { id } = await params;
  const repo = getRepository();
  const session = await getSession();

  const artwork = await repo.artwork.findById(id);

  // 404: not found or removed
  if (!artwork || artwork.status === "removed") {
    notFound();
  }

  // Private artwork: only owner can view
  if (artwork.permission === "private") {
    if (!session || artwork.creatorId === null || session.userId !== artwork.creatorId) {
      notFound();
    }
  }

  const [campaign, creator] = await Promise.all([
    repo.campaign.findById(artwork.campaignId),
    artwork.creatorId ? repo.auth.getUser(artwork.creatorId) : Promise.resolve(null),
  ]);

  const isOwner = session !== null && artwork.creatorId !== null && session.userId === artwork.creatorId;
  const isAuthenticated = session !== null;
  const isLiked = session ? artwork.likedBy.includes(session.userId) : false;

  const statusVariant = {
    draft: "secondary",
    saved: "outline",
    published: "success",
    flagged: "warning",
    removed: "destructive",
  } as const;

  const permissionLabel = {
    public: "Public",
    unlisted: "Unlisted",
    private: "Private",
  };

  return (
    <main className="flex-1">
      {/* Full-width artwork image */}
      <section className="border-b border-[var(--color-border)]" style={{ backgroundColor: "#0a0a0a" }}>
        {artwork.imageUrl ? (
          <div className="relative w-full aspect-video">
            <Image
              src={artwork.imageUrl}
              alt={artwork.title}
              fill
              className="object-contain"
              priority
            />
          </div>
        ) : (
          <ArtworkPlaceholder title={artwork.title} />
        )}
      </section>

      {/* Artwork info & controls */}
      <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-10 md:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Main info */}
          <div className="lg:col-span-7">
            {/* Status badges */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Badge
                variant={statusVariant[artwork.status] ?? "outline"}
              >
                {artwork.status}
              </Badge>
              <Badge variant="outline">
                {permissionLabel[artwork.permission]}
              </Badge>
              {artwork.moderationStatus !== "approved" && (
                <Badge variant="warning">
                  moderation: {artwork.moderationStatus}
                </Badge>
              )}
            </div>

            {/* Title */}
            <h1
              className="heading-display mb-4"
              style={{
                fontSize: "clamp(2rem,6vw,5rem)",
                color: "#f5f5f0",
                lineHeight: 1.0,
              }}
            >
              {artwork.title}
            </h1>

            {/* Creator & date */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-6 text-sm text-[var(--color-fg-muted)]">
              {creator ? (
                <span>
                  by <span className="text-[var(--color-fg)]">{creator.displayName}</span>
                </span>
              ) : (
                <span className="italic">Anonymous</span>
              )}
              <span className="text-[var(--color-fg-subtle)]">·</span>
              <time dateTime={artwork.createdAt}>
                {formatDate(artwork.createdAt)}
              </time>
            </div>

            {/* Stat row */}
            <div className="flex gap-6 pb-6 mb-6 border-b border-[var(--color-border)]">
              <div>
                <p className="font-mono text-2xl font-bold text-[var(--color-fg)]">
                  {formatCount(artwork.likeCount)}
                </p>
                <p className="caption-label text-[var(--color-fg-subtle)] text-[10px]">Likes</p>
              </div>
              <div>
                <p className="font-mono text-2xl font-bold text-[var(--color-fg)]">
                  {formatCount(artwork.shareCount)}
                </p>
                <p className="caption-label text-[var(--color-fg-subtle)] text-[10px]">Shares</p>
              </div>
            </div>

            {/* Interactive client controls */}
            <ArtworkDetailClient
              artworkId={artwork.id}
              initialLikeCount={artwork.likeCount}
              initialIsLiked={isLiked}
              permission={artwork.permission}
              isOwner={isOwner}
              isAuthenticated={isAuthenticated}
              campaignSlug={campaign?.slug ?? ""}
              artworkTitle={artwork.title}
            />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-5 space-y-6">
            {/* Campaign link */}
            {campaign && (
              <div className="border border-[var(--color-border)] p-5">
                <p className="caption-label text-[var(--color-fg-subtle)] mb-3">Campaign</p>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <Badge
                      variant={campaign.status === "active" ? "accent" : "secondary"}
                      className="mb-2"
                    >
                      {campaign.status}
                    </Badge>
                    <h3 className="font-semibold text-[var(--color-fg)]">{campaign.title}</h3>
                  </div>
                </div>
                {campaign.branding.tagline && (
                  <p className="text-sm italic text-[var(--color-accent)] mb-3">
                    &ldquo;{campaign.branding.tagline}&rdquo;
                  </p>
                )}
                <div className="flex flex-col gap-2 pt-3 border-t border-[var(--color-border)]">
                  <Link
                    href={`/campaigns/${campaign.slug}`}
                    className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] transition-colors flex items-center gap-1.5"
                  >
                    View campaign
                    <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <path d="M1 11 11 1M11 1H4M11 1v7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                  <Link
                    href={`/campaigns/${campaign.slug}/gallery`}
                    className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] transition-colors flex items-center gap-1.5"
                  >
                    Browse gallery
                    <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <path d="M1 11 11 1M11 1H4M11 1v7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </div>
              </div>
            )}

            {/* Artwork metadata */}
            <div className="border border-[var(--color-border)] p-5">
              <p className="caption-label text-[var(--color-fg-subtle)] mb-3">Details</p>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--color-fg-muted)]">Experience Version</dt>
                  <dd className="font-mono text-[var(--color-fg-subtle)]">{artwork.experienceVersionId}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-fg-muted)]">Seed</dt>
                  <dd className="font-mono text-[var(--color-fg-subtle)]">
                    {artwork.customization.deterministicSeed}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-fg-muted)]">Capture Frame</dt>
                  <dd className="font-mono text-[var(--color-fg-subtle)]">
                    {artwork.customization.captureFrameMs}ms
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-fg-muted)]">Updated</dt>
                  <dd className="text-[var(--color-fg-subtle)]">{formatDate(artwork.updatedAt)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-12 pt-6 border-t border-[var(--color-border)] flex flex-wrap gap-4">
          <Link
            href="/explore"
            className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            ← Back to Explore
          </Link>
          {isOwner && (
            <Link
              href="/me/artworks"
              className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              ← My Artworks
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
