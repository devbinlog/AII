// force-dynamic: getRepository() accesses in-memory mock adapter (Node.js singleton).
// The adapter's state is mutable at runtime, so static generation would produce stale HTML.
// In production mode, a real data layer would allow static generation with revalidation.
export const dynamic = "force-dynamic";

import Link from "next/link";
import { getRepository } from "@/lib/repository";
import { isPublicRelease } from "@/lib/public-visibility";
import { MOCK_IDS } from "@/lib/mock/fixtures";
import { Badge } from "@/components/ui/badge";
import { formatCount, formatDate, formatDuration } from "@/lib/utils/format";
import type { Release, Artist, Campaign } from "@/types";

function ReleaseCoverPlaceholder({ color = "#e8192c" }: { color?: string }) {
  return (
    <div
      className="aspect-square relative overflow-hidden"
      style={{ backgroundColor: "#0a0a0a" }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 400 400" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="400" fill="#0a0a0a" />
        <circle cx="200" cy="200" r="190" fill="none" stroke={color} strokeWidth="0.5" opacity="0.3" />
        <circle cx="200" cy="200" r="140" fill="none" stroke={color} strokeWidth="0.5" opacity="0.5" />
        <circle cx="200" cy="200" r="90" fill="none" stroke={color} strokeWidth="1" opacity="0.6" />
        <circle cx="200" cy="200" r="40" fill={color} opacity="0.15" />
        <line x1="0" y1="200" x2="400" y2="200" stroke={color} strokeWidth="0.5" opacity="0.2" />
        <line x1="200" y1="0" x2="200" y2="400" stroke={color} strokeWidth="0.5" opacity="0.2" />
        <line x1="0" y1="0" x2="400" y2="400" stroke={color} strokeWidth="0.5" opacity="0.1" />
        <line x1="400" y1="0" x2="0" y2="400" stroke={color} strokeWidth="0.5" opacity="0.1" />
      </svg>
    </div>
  );
}

function ArtistPlaceholderBg({ primaryColor }: { primaryColor: string }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      aria-hidden="true"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      <svg viewBox="0 0 1440 600" className="w-full h-full" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="1440" height="600" fill="#0a0a0a" />
        <rect x="0" y="0" width="1" height="600" fill={primaryColor} opacity="0.6" />
        <rect x="720" y="0" width="1" height="600" fill={primaryColor} opacity="0.15" />
        <rect x="1439" y="0" width="1" height="600" fill={primaryColor} opacity="0.6" />
        <rect x="0" y="299" width="1440" height="1" fill={primaryColor} opacity="0.2" />
        {Array.from({ length: 8 }).map((_, i) => (
          <rect
            key={i}
            x={i * 180}
            y="0"
            width="1"
            height="600"
            fill={primaryColor}
            opacity={0.04 + i * 0.01}
          />
        ))}
      </svg>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 70% 50%, ${primaryColor}22 0%, transparent 70%)`,
        }}
      />
    </div>
  );
}

function FeaturedRelease({ release }: { release: Release }) {
  return (
    <section className="border-b border-[var(--color-border)]">
      <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-start">
          <div className="md:col-span-4">
            <ReleaseCoverPlaceholder />
          </div>
          <div className="md:col-span-8">
            <p className="caption-label text-[var(--color-accent)] mb-4">Latest Release</p>
            <div className="flex items-center gap-3 mb-3">
              <Badge variant="outline">{release.type.toUpperCase()}</Badge>
              <span className="text-sm text-[var(--color-fg-muted)]">
                {formatDate(release.releaseDate, { year: "numeric", month: "long", day: "numeric" })}
              </span>
            </div>
            <h2 className="heading-editorial text-[clamp(2rem,5vw,4rem)] text-[var(--color-fg)] mb-4">
              {release.title}
            </h2>
            <p className="text-[var(--color-fg-muted)] max-w-md mb-8 leading-relaxed">
              {release.description}
            </p>

            <div className="border-t border-[var(--color-border)] pt-6">
              <p className="caption-label text-[var(--color-fg-subtle)] mb-4">Tracklist</p>
              <ol className="space-y-3">
                {release.tracks.map((track) => (
                  <li
                    key={track.id}
                    className="flex items-center gap-4 group"
                  >
                    <span className="w-6 text-right font-mono text-xs text-[var(--color-fg-subtle)] shrink-0">
                      {String(track.position).padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-sm font-medium text-[var(--color-fg)] group-hover:text-[var(--color-accent)] transition-colors">
                      {track.title}
                    </span>
                    <span className="font-mono text-xs text-[var(--color-fg-subtle)] shrink-0">
                      {formatDuration(track.durationMs)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-8">
              <Link
                href={`/releases/${release.id}`}
                className="inline-flex items-center gap-2 text-sm font-semibold border border-[var(--color-fg)] px-5 py-2.5 hover:bg-[var(--color-fg)] hover:text-[var(--color-bg)] transition-all"
              >
                Release Details →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturedArtist({ artist }: { artist: Artist }) {
  return (
    <section className="relative min-h-[60vh] flex items-end overflow-hidden">
      <ArtistPlaceholderBg primaryColor={artist.branding.primaryColor} />
      <div className="relative z-10 w-full max-w-[var(--container-2xl)] mx-auto px-6 py-16 md:py-20">
        <div className="max-w-3xl">
          <p className="caption-label text-[var(--color-accent)] mb-6">Featured Artist</p>
          <div className="flex flex-wrap gap-2 mb-6">
            {artist.genre.map((g) => (
              <Badge
                key={g}
                className="border-white/20 text-white/60"
                style={{ border: "1px solid rgba(255,255,255,0.2)", background: "transparent" }}
              >
                {g}
              </Badge>
            ))}
          </div>
          <h2
            className="heading-display text-[clamp(4rem,12vw,12rem)] leading-none"
            style={{ color: "#f5f5f0" }}
          >
            {artist.name}
          </h2>
          <div className="mt-6 flex flex-col sm:flex-row sm:items-end gap-6">
            <p className="text-sm max-w-md leading-relaxed" style={{ color: "rgba(245,245,240,0.6)" }}>
              {artist.bio}
            </p>
            <div className="shrink-0 flex flex-col gap-1">
              <span className="font-mono text-2xl font-bold" style={{ color: "#f5f5f0" }}>
                {formatCount(artist.followerCount)}
              </span>
              <span className="caption-label" style={{ color: "rgba(245,245,240,0.4)" }}>
                Followers
              </span>
            </div>
          </div>
          <div className="mt-8">
            <Link
              href={`/artists/${artist.slug}`}
              className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 transition-all"
              style={{
                border: `1px solid ${artist.branding.primaryColor}`,
                color: artist.branding.primaryColor,
              }}
            >
              View Artist Profile →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function CampaignPreview({ campaign }: { campaign: Campaign }) {
  const isActive = campaign.status === "active";
  const endsAt = campaign.endsAt ? new Date(campaign.endsAt) : null;

  return (
    <section className="border-b border-[var(--color-border)]">
      <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-7">
            <div className="flex items-center gap-3 mb-4">
              <p className="caption-label text-[var(--color-accent)]">Active Campaign</p>
              {isActive && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <h2 className="heading-editorial text-[clamp(1.75rem,4vw,3rem)] text-[var(--color-fg)] mb-3">
              {campaign.title}
            </h2>
            {campaign.branding.tagline && (
              <p className="text-[var(--color-accent)] text-sm font-medium mb-4 italic">
                &ldquo;{campaign.branding.tagline}&rdquo;
              </p>
            )}
            <p className="text-[var(--color-fg-muted)] max-w-lg leading-relaxed">
              {campaign.description}
            </p>
            {endsAt && (
              <p className="mt-4 text-xs text-[var(--color-fg-subtle)]">
                Campaign ends{" "}
                {formatDate(endsAt.toISOString(), {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}
            <div className="mt-6">
              <span
                className="inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 opacity-40 cursor-not-allowed border border-[var(--color-border)] text-[var(--color-fg-muted)]"
                aria-disabled="true"
                title="Campaign experience — coming in Phase 2"
              >
                Enter Campaign
                <span className="text-xs">(Phase 2)</span>
              </span>
            </div>
          </div>
          <div className="md:col-span-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-[var(--color-border)] p-5">
                <p className="font-mono text-3xl font-bold text-[var(--color-fg)]">
                  {formatCount(campaign.participantCount)}
                </p>
                <p className="caption-label text-[var(--color-fg-subtle)] mt-1">Participants</p>
              </div>
              <div className="border border-[var(--color-border)] p-5">
                <p className="font-mono text-3xl font-bold text-[var(--color-fg)]">
                  {formatCount(campaign.artworkCount)}
                </p>
                <p className="caption-label text-[var(--color-fg-subtle)] mt-1">Artworks</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const repo = getRepository();
  const [featuredArtist, releaseResult, campaignResult] = await Promise.all([
    repo.artist.findById(MOCK_IDS.ARTIST_FREEFALLERS),
    repo.release.listByArtist(MOCK_IDS.ARTIST_FREEFALLERS, { page: 1, pageSize: 50 }),
    repo.campaign.listPublic({ page: 1, pageSize: 1, status: "active" }),
  ]);

  const featuredRelease = releaseResult.releases.find(isPublicRelease) ?? null;
  const activeCampaign = campaignResult.campaigns[0] ?? null;

  return (
    <main className="flex-1">
      {/* Hero */}
      <section
        className="relative min-h-[88vh] flex flex-col justify-between px-6 py-12 overflow-hidden"
        style={{ backgroundColor: "#0a0a0a" }}
      >
        <div className="max-w-[var(--container-2xl)] mx-auto w-full flex items-center justify-between">
          <p className="caption-label" style={{ color: "#e8192c" }}>
            Make Your Sound Visible
          </p>
          <p
            className="caption-label hidden sm:block"
            style={{ color: "rgba(245,245,240,0.3)" }}
          >
            Independent Music Editorial × Creative Technology
          </p>
        </div>

        <div className="max-w-[var(--container-2xl)] mx-auto w-full flex-1 flex items-center">
          <h1
            className="heading-display"
            style={{
              fontSize: "clamp(6rem, 22vw, 22rem)",
              lineHeight: 0.88,
              color: "#f5f5f0",
              letterSpacing: "-0.04em",
            }}
          >
            AII
          </h1>
        </div>

        <div className="max-w-[var(--container-2xl)] mx-auto w-full flex flex-col sm:flex-row items-start sm:items-end gap-6 justify-between">
          <p
            className="text-sm max-w-xs leading-relaxed"
            style={{ color: "rgba(245,245,240,0.4)" }}
          >
            The platform where artists create interactive music experiences and fans participate in them.
          </p>
          <div className="flex gap-6">
            <Link
              href="/explore"
              className="text-sm font-semibold transition-colors"
              style={{ color: "#f5f5f0" }}
            >
              Discover Artists →
            </Link>
          </div>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ backgroundColor: "#e8192c" }}
        />
      </section>

      {/* Featured Release */}
      {featuredRelease && <FeaturedRelease release={featuredRelease} />}

      {/* Featured Artist */}
      {featuredArtist && <FeaturedArtist artist={featuredArtist} />}

      {/* Active Campaign */}
      {activeCampaign && <CampaignPreview campaign={activeCampaign} />}

      {/* CTA Strip */}
      <section
        className="border-b border-[var(--color-border)]"
        style={{ backgroundColor: "#0a0a0a" }}
      >
        <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-16 md:py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px border border-[var(--color-neutral-800)]">
            <Link
              href="/explore"
              className="group p-10 hover:bg-[var(--color-neutral-900)] transition-colors"
            >
              <p className="caption-label mb-4" style={{ color: "rgba(245,245,240,0.3)" }}>
                01
              </p>
              <h3
                className="heading-editorial text-4xl mb-3"
                style={{ color: "#f5f5f0" }}
              >
                Discover Artists
              </h3>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(245,245,240,0.4)" }}>
                Explore independent artists, releases, and campaigns on AII.
              </p>
              <span
                className="text-sm font-semibold group-hover:gap-4 transition-all"
                style={{ color: "#e8192c" }}
              >
                Browse Explore →
              </span>
            </Link>
            <div className="group p-10 border-l border-[var(--color-neutral-800)] opacity-40">
              <p className="caption-label mb-4" style={{ color: "rgba(245,245,240,0.3)" }}>
                02
              </p>
              <h3
                className="heading-editorial text-4xl mb-3"
                style={{ color: "#f5f5f0" }}
              >
                Create Experience
              </h3>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(245,245,240,0.4)" }}>
                Artist Studio — coming in Phase 2. Build interactive music experiences for your fans.
              </p>
              <span
                className="text-sm font-semibold"
                style={{ color: "rgba(245,245,240,0.2)" }}
              >
                Artist Studio (Phase 2)
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
