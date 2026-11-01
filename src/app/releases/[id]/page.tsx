export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRepository } from "@/lib/repository";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDuration, formatCount } from "@/lib/utils/format";
import type { Artist, Campaign, Experience } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const repo = getRepository();
  const release = await repo.release.findById(id);
  if (!release) return { title: "Release Not Found" };
  return {
    title: release.title,
    description: release.description,
  };
}

function LargeCoverPlaceholder({ color = "#e8192c" }: { color?: string }) {
  return (
    <div
      className="aspect-square w-full relative overflow-hidden"
      style={{ backgroundColor: "#0a0a0a" }}
      aria-label="Release cover art placeholder"
      role="img"
    >
      <svg viewBox="0 0 600 600" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="600" fill="#0a0a0a" />

        {/* Concentric circles */}
        {[280, 220, 160, 100, 50, 20].map((r, i) => (
          <circle
            key={r}
            cx="300"
            cy="300"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={i === 0 ? 0.5 : 0.5}
            opacity={0.1 + i * 0.08}
          />
        ))}

        {/* Center dot */}
        <circle cx="300" cy="300" r="8" fill={color} opacity="0.5" />

        {/* Grid */}
        <line x1="0" y1="300" x2="600" y2="300" stroke={color} strokeWidth="0.5" opacity="0.08" />
        <line x1="300" y1="0" x2="300" y2="600" stroke={color} strokeWidth="0.5" opacity="0.08" />
        <line x1="0" y1="0" x2="600" y2="600" stroke={color} strokeWidth="0.5" opacity="0.04" />
        <line x1="600" y1="0" x2="0" y2="600" stroke={color} strokeWidth="0.5" opacity="0.04" />

        {/* Corner marks */}
        {[[20, 20], [580, 20], [580, 580], [20, 580]].map(([cx, cy], i) => (
          <g key={i}>
            <line x1={cx} y1={cy! - 10} x2={cx} y2={cy! + 10} stroke={color} strokeWidth="1" opacity="0.3" />
            <line x1={cx! - 10} y1={cy} x2={cx! + 10} y2={cy} stroke={color} strokeWidth="1" opacity="0.3" />
          </g>
        ))}
      </svg>
    </div>
  );
}

function TrackListEmpty() {
  return (
    <p className="text-sm text-[var(--color-fg-muted)] py-4">No tracks available.</p>
  );
}

export default async function ReleaseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const repo = getRepository();

  const release = await repo.release.findById(id);
  if (!release) notFound();

  const artist = await repo.artist.findById(release.artistId) as Artist | null;

  // Find linked campaign / experience
  let linkedExperience: Experience | null = null;
  let linkedCampaign: Campaign | null = null;

  if (artist) {
    const [expResult, campResult] = await Promise.all([
      repo.experience.listByArtist(artist.id, { page: 1, pageSize: 20 }),
      repo.campaign.listByArtist(artist.id, { page: 1, pageSize: 20 }),
    ]);
    linkedExperience = expResult.experiences.find((e) => e.releaseId === release.id) ?? null;
    if (linkedExperience) {
      linkedCampaign =
        campResult.campaigns.find((c) => c.experienceId === linkedExperience!.id) ?? null;
    }
  }

  const accentColor = artist?.branding.primaryColor ?? "#e8192c";

  const totalDuration = release.tracks.reduce((s, t) => s + t.durationMs, 0);
  const hasAudio = release.tracks.some((t) => t.audioUrl !== null || t.previewUrl !== null);

  return (
    <main className="flex-1">
      {/* Header */}
      <section
        className="border-b border-[var(--color-border)]"
        style={{ backgroundColor: "#0a0a0a" }}
      >
        <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-12 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-start">
            {/* Cover art */}
            <div className="md:col-span-4 lg:col-span-3">
              <LargeCoverPlaceholder color={accentColor} />
            </div>

            {/* Metadata */}
            <div className="md:col-span-8 lg:col-span-9">
              {artist && (
                <Link
                  href={`/artists/${artist.slug}`}
                  className="inline-block caption-label mb-3 transition-colors"
                  style={{ color: accentColor }}
                >
                  {artist.name} ↗
                </Link>
              )}

              <div className="flex items-center gap-3 mb-3">
                <Badge
                  className="capitalize"
                  style={{ backgroundColor: accentColor, color: "#fff" }}
                >
                  {release.type}
                </Badge>
                <Badge
                  variant={release.status === "released" ? "default" : "secondary"}
                >
                  {release.status}
                </Badge>
              </div>

              <h1
                className="heading-display"
                style={{
                  fontSize: "clamp(2.5rem,7vw,7rem)",
                  color: "#f5f5f0",
                  lineHeight: 0.92,
                }}
              >
                {release.title}
              </h1>

              <p
                className="mt-5 text-sm leading-relaxed max-w-lg"
                style={{ color: "rgba(245,245,240,0.5)" }}
              >
                {release.description}
              </p>

              {/* Stats row */}
              <div
                className="mt-8 flex flex-wrap items-center gap-6 text-sm"
                style={{ color: "rgba(245,245,240,0.4)" }}
              >
                <div>
                  <span className="font-mono font-bold" style={{ color: "#f5f5f0" }}>
                    {formatDate(release.releaseDate, { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                  <span className="ml-2">Release date</span>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div>
                  <span className="font-mono font-bold" style={{ color: "#f5f5f0" }}>
                    {release.tracks.length}
                  </span>
                  <span className="ml-2">tracks</span>
                </div>
                {totalDuration > 0 && (
                  <>
                    <div className="w-px h-4 bg-white/10" />
                    <div>
                      <span className="font-mono font-bold" style={{ color: "#f5f5f0" }}>
                        {formatDuration(totalDuration)}
                      </span>
                      <span className="ml-2">runtime</span>
                    </div>
                  </>
                )}
              </div>

              {release.label && (
                <p className="mt-3 text-xs" style={{ color: "rgba(245,245,240,0.3)" }}>
                  {release.label}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Track list */}
      <section className="border-b border-[var(--color-border)]">
        <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-12 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-3">
              <p className="caption-label text-[var(--color-fg-subtle)]">Tracklist</p>
              {!hasAudio && (
                <p className="text-xs text-[var(--color-fg-subtle)] mt-2 leading-relaxed">
                  Audio preview not available in mock mode.
                </p>
              )}
            </div>
            <div className="md:col-span-9">
              {release.tracks.length === 0 ? (
                <TrackListEmpty />
              ) : (
                <ol className="space-y-1">
                  {/* Header row */}
                  <li className="flex items-center gap-4 pb-3 border-b border-[var(--color-border)]">
                    <span className="w-8 text-right caption-label text-[var(--color-fg-subtle)]">#</span>
                    <span className="flex-1 caption-label text-[var(--color-fg-subtle)]">Title</span>
                    {release.tracks.some((t) => t.isrc) && (
                      <span className="hidden md:block w-32 caption-label text-[var(--color-fg-subtle)]">ISRC</span>
                    )}
                    <span className="w-16 text-right caption-label text-[var(--color-fg-subtle)]">Duration</span>
                  </li>

                  {release.tracks.map((track) => (
                    <li
                      key={track.id}
                      className="flex items-center gap-4 py-3 border-b border-[var(--color-border)] group"
                    >
                      <span className="w-8 text-right font-mono text-xs text-[var(--color-fg-subtle)] shrink-0">
                        {String(track.position).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-[var(--color-fg)] group-hover:text-[var(--color-accent)] transition-colors">
                          {track.title}
                        </span>
                      </div>
                      {release.tracks.some((t) => t.isrc) && (
                        <span className="hidden md:block w-32 font-mono text-xs text-[var(--color-fg-subtle)] shrink-0">
                          {track.isrc ?? "—"}
                        </span>
                      )}
                      <span className="w-16 text-right font-mono text-xs text-[var(--color-fg-muted)] shrink-0">
                        {formatDuration(track.durationMs)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Credits & Metadata */}
      <section className="border-b border-[var(--color-border)]">
        <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-10 md:py-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-3">
              <p className="caption-label text-[var(--color-fg-subtle)]">Credits</p>
            </div>
            <div className="md:col-span-9">
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4 text-sm">
                <div>
                  <dt className="caption-label text-[var(--color-fg-subtle)] mb-1">Artist</dt>
                  <dd className="text-[var(--color-fg)]">
                    {artist ? (
                      <Link
                        href={`/artists/${artist.slug}`}
                        className="hover:text-[var(--color-accent)] transition-colors"
                      >
                        {artist.name}
                      </Link>
                    ) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="caption-label text-[var(--color-fg-subtle)] mb-1">Release Type</dt>
                  <dd className="text-[var(--color-fg)] capitalize">{release.type}</dd>
                </div>
                <div>
                  <dt className="caption-label text-[var(--color-fg-subtle)] mb-1">Release Date</dt>
                  <dd className="text-[var(--color-fg)]">
                    {formatDate(release.releaseDate, { year: "numeric", month: "long", day: "numeric" })}
                  </dd>
                </div>
                {release.label && (
                  <div>
                    <dt className="caption-label text-[var(--color-fg-subtle)] mb-1">Label</dt>
                    <dd className="text-[var(--color-fg)]">{release.label}</dd>
                  </div>
                )}
                {release.upc && (
                  <div>
                    <dt className="caption-label text-[var(--color-fg-subtle)] mb-1">UPC</dt>
                    <dd className="font-mono text-[var(--color-fg)]">{release.upc}</dd>
                  </div>
                )}
                <div>
                  <dt className="caption-label text-[var(--color-fg-subtle)] mb-1">Tracks</dt>
                  <dd className="text-[var(--color-fg)]">{release.tracks.length}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* Linked Experience / Campaign */}
      {(linkedExperience || linkedCampaign) && (
        <section className="border-b border-[var(--color-border)]">
          <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-12 md:py-16">
            <h2 className="heading-editorial text-2xl text-[var(--color-fg)] mb-6">
              Creative Experience
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {linkedExperience && (
                <div className="border border-[var(--color-border)] p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <Badge
                        variant={linkedExperience.status === "published" ? "accent" : "secondary"}
                        className="mb-2"
                      >
                        {linkedExperience.status}
                      </Badge>
                      <h3 className="font-semibold">{linkedExperience.title}</h3>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-lg font-bold">
                        {formatCount(linkedExperience.totalPlayCount)}
                      </p>
                      <p className="caption-label text-[var(--color-fg-subtle)] text-[10px]">Plays</p>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed mb-3">
                    {linkedExperience.description}
                  </p>
                  <p className="text-xs text-[var(--color-fg-subtle)]">
                    {linkedExperience.scenes.length} scene
                    {linkedExperience.scenes.length !== 1 ? "s" : ""}
                  </p>
                  <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
                    <span className="text-xs text-[var(--color-fg-subtle)] italic">
                      Interactive experience — Phase 2
                    </span>
                  </div>
                </div>
              )}

              {linkedCampaign && (
                <div className="border border-[var(--color-border)] p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      variant={
                        linkedCampaign.status === "active"
                          ? "accent"
                          : linkedCampaign.status === "ended"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {linkedCampaign.status}
                    </Badge>
                    {linkedCampaign.status === "active" && (
                      <span className="flex items-center gap-1 text-xs text-emerald-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        LIVE
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold mb-2">{linkedCampaign.title}</h3>
                  {linkedCampaign.branding.tagline && (
                    <p className="text-sm italic text-[var(--color-accent)] mb-3">
                      &ldquo;{linkedCampaign.branding.tagline}&rdquo;
                    </p>
                  )}
                  <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed mb-4 line-clamp-2">
                    {linkedCampaign.description}
                  </p>
                  <div className="flex gap-6 text-sm">
                    <div>
                      <span className="font-mono font-bold">
                        {formatCount(linkedCampaign.participantCount)}
                      </span>
                      <span className="text-[var(--color-fg-subtle)] ml-1.5">participants</span>
                    </div>
                    <div>
                      <span className="font-mono font-bold">
                        {formatCount(linkedCampaign.artworkCount)}
                      </span>
                      <span className="text-[var(--color-fg-subtle)] ml-1.5">artworks</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
                    <span
                      className="text-xs text-[var(--color-fg-subtle)] italic"
                      title="Campaign experience — coming in Phase 2"
                    >
                      Campaign experience — Phase 2
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Navigation */}
      <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-8 flex items-center justify-between">
        <Link
          href="/explore"
          className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          ← Back to Explore
        </Link>
        {artist && (
          <Link
            href={`/artists/${artist.slug}`}
            className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            More from {artist.name} →
          </Link>
        )}
      </div>
    </main>
  );
}
