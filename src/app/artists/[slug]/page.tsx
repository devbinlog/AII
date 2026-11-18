// force-dynamic: slug-based lookup uses getRepository() which returns in-memory mock data.
// Static params cannot be determined at build time in MOCK_ONLY mode.
export const dynamic = "force-dynamic";

import { ArtistLogo } from "@/components/brand/artist-logo";
import { TRACKING_EM, brandFontStack, brandName } from "@/lib/brand/brand";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRepository } from "@/lib/repository";
import { isPublicCampaign, isPublicExperience, isPublicRelease } from "@/lib/public-visibility";
import { Badge } from "@/components/ui/badge";
import { formatCount, formatDate, formatDuration, formatNumber } from "@/lib/utils/format";
import type { Release, Experience } from "@/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const repo = getRepository();
  const artist = await repo.artist.findBySlug(slug);
  if (!artist) return { title: "Artist Not Found" };
  return {
    title: artist.name,
    description: artist.bio,
  };
}

function ArtistHeroBg({ primaryColor }: { primaryColor: string }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      aria-hidden="true"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      <svg
        viewBox="0 0 1440 700"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="1440" height="700" fill="#0a0a0a" />
        {Array.from({ length: 24 }).map((_, i) => (
          <line
            key={i}
            x1={i * 60}
            y1="0"
            x2={i * 60}
            y2="700"
            stroke={primaryColor}
            strokeWidth="0.5"
            opacity={0.06}
          />
        ))}
        <line x1="0" y1="350" x2="1440" y2="350" stroke={primaryColor} strokeWidth="0.5" opacity="0.1" />
        <circle cx="1100" cy="350" r="300" fill="none" stroke={primaryColor} strokeWidth="0.5" opacity="0.15" />
        <circle cx="1100" cy="350" r="200" fill="none" stroke={primaryColor} strokeWidth="0.5" opacity="0.1" />
        <circle cx="1100" cy="350" r="100" fill={primaryColor} opacity="0.05" />
      </svg>
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to right, #0a0a0a 40%, transparent 100%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 60% 80% at 75% 50%, ${primaryColor}15 0%, transparent 70%)`,
        }}
      />
    </div>
  );
}

function ReleaseCoverPlaceholder({ color = "#e8192c", size = 200 }: { color?: string; size?: number }) {
  return (
    <div
      style={{ backgroundColor: "#0a0a0a", width: size, height: size }}
      className="relative overflow-hidden shrink-0"
      aria-hidden="true"
    >
      <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#0a0a0a" />
        <circle cx="100" cy="100" r="90" fill="none" stroke={color} strokeWidth="0.5" opacity="0.4" />
        <circle cx="100" cy="100" r="60" fill="none" stroke={color} strokeWidth="0.5" opacity="0.5" />
        <circle cx="100" cy="100" r="30" fill={color} opacity="0.12" />
        <line x1="0" y1="100" x2="200" y2="100" stroke={color} strokeWidth="0.5" opacity="0.2" />
        <line x1="100" y1="0" x2="100" y2="200" stroke={color} strokeWidth="0.5" opacity="0.2" />
      </svg>
    </div>
  );
}

function ReleaseCard({ release, accentColor }: { release: Release; accentColor: string }) {
  return (
    <Link
      href={`/releases/${release.id}`}
      className="group flex gap-4 border border-[var(--color-border)] p-4 hover:border-[var(--color-fg-muted)] transition-all"
    >
      <ReleaseCoverPlaceholder color={accentColor} size={80} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs">{release.type}</Badge>
          <span className="text-xs text-[var(--color-fg-muted)]">
            {formatDate(release.releaseDate, { year: "numeric", month: "short" })}
          </span>
        </div>
        <h3 className="font-semibold text-sm group-hover:text-[var(--color-accent)] transition-colors mb-1 truncate">
          {release.title}
        </h3>
        <p className="text-xs text-[var(--color-fg-muted)] line-clamp-2 leading-relaxed">
          {release.description}
        </p>
        <p className="text-xs text-[var(--color-fg-subtle)] mt-2">
          {release.tracks.length} tracks ·{" "}
          {formatDuration(release.tracks.reduce((s, t) => s + t.durationMs, 0))}
        </p>
      </div>
    </Link>
  );
}

function ExperienceEntry({ experience }: { experience: Experience }) {
  return (
    <div className="border border-[var(--color-border)] p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <Badge
            variant={experience.status === "published" ? "accent" : "secondary"}
            className="mb-2"
          >
            {experience.status}
          </Badge>
          <h3 className="font-semibold">{experience.title}</h3>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-lg font-bold text-[var(--color-fg)]">
            {formatCount(experience.totalPlayCount)}
          </p>
          <p className="caption-label text-[var(--color-fg-subtle)] text-[10px]">Plays</p>
        </div>
      </div>
      <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed mb-3">
        {experience.description}
      </p>
      <p className="text-xs text-[var(--color-fg-subtle)]">
        {experience.scenes.length} scene{experience.scenes.length !== 1 ? "s" : ""}
      </p>
      <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
        <span className="text-xs text-[var(--color-fg-subtle)] italic">
          Interactive experience — Phase 2
        </span>
      </div>
    </div>
  );
}

export default async function ArtistProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const repo = getRepository();

  const artist = await repo.artist.findBySlug(slug);
  if (!artist) notFound();

  const [releaseResult, campaignResult, experienceResult, publishedStage] = await Promise.all([
    repo.release.listByArtist(artist.id, { page: 1, pageSize: 20 }),
    repo.campaign.listByArtist(artist.id, { page: 1, pageSize: 10 }),
    repo.experience.listByArtist(artist.id, { page: 1, pageSize: 10 }),
    // Only a published version counts; drafts are never surfaced here.
    repo.stage.getPublished(artist.id),
  ]);

  const releases = releaseResult.releases.filter(isPublicRelease);
  const campaigns = campaignResult.campaigns.filter(isPublicCampaign);
  const experiences = experienceResult.experiences.filter(isPublicExperience);

  const socialEntries = Object.entries(artist.socialLinks).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="relative min-h-[60vh] flex items-end overflow-hidden">
        <ArtistHeroBg primaryColor={artist.branding.primaryColor} />

        <div className="relative z-10 w-full max-w-[var(--container-2xl)] mx-auto px-6 py-16 md:py-20">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {artist.isVerified && (
              <span
                className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5"
                style={{
                  backgroundColor: artist.branding.primaryColor,
                  color: "#fff",
                }}
              >
                <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 6l3 3 5-5" />
                </svg>
                Verified
              </span>
            )}
            <Badge
              className="border-white/20 text-white/60"
              style={{ border: "1px solid rgba(255,255,255,0.2)", background: "transparent" }}
            >
              {artist.status}
            </Badge>
          </div>

          {artist.branding.logo && artist.branding.logo.mark !== "none" && (
            <ArtistLogo branding={{ ...artist.branding, logo: { ...artist.branding.logo, layout: "mark-only" } }} artistName={artist.name} size="lg" className="mb-6" />
          )}
          <h1
            className="heading-display"
            aria-label={brandName(artist.branding, artist.name) !== artist.name ? artist.name : undefined}
            style={{
              fontSize: "clamp(4rem,12vw,12rem)",
              color: "#f5f5f0",
              lineHeight: 0.9,
              fontFamily: brandFontStack(artist.branding.fontFamily),
              ...(artist.branding.logo ? { letterSpacing: TRACKING_EM[artist.branding.logo.tracking] } : {}),
              ...(artist.branding.logo?.case === "upper" ? { textTransform: "uppercase" as const } : artist.branding.logo?.case === "lower" ? { textTransform: "lowercase" as const } : {}),
            }}
          >
            {brandName(artist.branding, artist.name)}
          </h1>

          <div className="mt-6 flex flex-wrap gap-2">
            {artist.genre.map((g) => (
              <span
                key={g}
                className="text-xs px-3 py-1 border capitalize"
                style={{ border: "1px solid rgba(255,255,255,0.2)", color: "rgba(245,245,240,0.6)" }}
              >
                {g}
              </span>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-8">
            <div>
              <p className="font-mono text-3xl font-bold" style={{ color: "#f5f5f0" }}>
                {formatCount(artist.followerCount)}
              </p>
              <p className="caption-label mt-0.5" style={{ color: "rgba(245,245,240,0.4)" }}>
                Followers
              </p>
            </div>
            <div>
              <p className="font-mono text-3xl font-bold" style={{ color: "#f5f5f0" }}>
                {releases.length}
              </p>
              <p className="caption-label mt-0.5" style={{ color: "rgba(245,245,240,0.4)" }}>
                Releases
              </p>
            </div>
            <div>
              <p className="font-mono text-3xl font-bold" style={{ color: "#f5f5f0" }}>
                {formatNumber(experiences.reduce((s, e) => s + e.totalPlayCount, 0))}
              </p>
              <p className="caption-label mt-0.5" style={{ color: "rgba(245,245,240,0.4)" }}>
                Experience Plays
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bio */}
      <section className="border-b border-[var(--color-border)]">
        <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-12 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-3">
              <p className="caption-label text-[var(--color-fg-subtle)]">About</p>
            </div>
            <div className="md:col-span-6">
              <p className="text-base leading-relaxed text-[var(--color-fg)]">
                {artist.bio}
              </p>
            </div>
            {socialEntries.length > 0 && (
              <div className="md:col-span-3">
                <p className="caption-label text-[var(--color-fg-subtle)] mb-4">Links</p>
                <ul className="space-y-2">
                  {socialEntries.map(([platform, url]) => (
                    <li key={platform}>
                      <a
                        href={url as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] transition-colors capitalize flex items-center gap-1.5"
                      >
                        {platform}
                        <svg viewBox="0 0 12 12" className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M1 11 11 1M11 1H4M11 1v7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Live Stage — shown only when a stage version is published */}
      {publishedStage && (
        <section className="border-b border-[var(--color-border)] text-[var(--aii-paper)]" style={{ backgroundColor: "var(--stage-void)" }} aria-labelledby="live-stage-title">
          <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-12 md:py-16 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-3">
              <p className="caption-label" style={{ color: "var(--stage-cyan)" }}>Live Stage</p>
            </div>
            <div className="md:col-span-6">
              <h2 id="live-stage-title" className="heading-editorial text-3xl">Step onto the live stage</h2>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "rgba(245,245,240,0.6)" }}>
                Explore the band&apos;s 3D stage layout — {publishedStage.items.filter((i) => i.kind === "performer").length} hologram members and their gear. Orbit, zoom, and tap anyone to see where they play.
              </p>
            </div>
            <div className="md:col-span-3 md:text-right">
              <Link
                href={`/artists/${artist.slug}/stage`}
                className="inline-flex h-11 items-center gap-2 px-5 text-sm font-semibold transition-opacity hover:opacity-85"
                style={{ backgroundColor: "var(--stage-cyan)", color: "var(--stage-void)" }}
              >
                Enter the 3D stage
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Brand Identity */}
      <section className="border-b border-[var(--color-border)]">
        <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-10 md:py-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-3">
              <p className="caption-label text-[var(--color-fg-subtle)]">Brand Identity</p>
            </div>
            <div className="md:col-span-9">
              <div className="flex items-center gap-3 flex-wrap">
                {[
                  { key: "Primary", color: artist.branding.primaryColor },
                  { key: "Secondary", color: artist.branding.secondaryColor },
                  { key: "Accent", color: artist.branding.accentColor },
                  { key: "Background", color: artist.branding.backgroundColor },
                ].map(({ key, color }) => (
                  <div key={key} className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 border border-[var(--color-border)]"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                    <div>
                      <p className="text-xs font-mono text-[var(--color-fg)]">{color}</p>
                      <p className="text-xs text-[var(--color-fg-subtle)]">{key}</p>
                    </div>
                  </div>
                ))}
                <div className="ml-4 flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {artist.branding.motionPreset} motion
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Discography */}
      {releases.length > 0 && (
        <section className="border-b border-[var(--color-border)]">
          <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-12 md:py-16">
            <div className="flex items-baseline justify-between mb-8">
              <h2 className="heading-editorial text-3xl text-[var(--color-fg)]">Discography</h2>
              <span className="text-sm text-[var(--color-fg-muted)]">
                {releases.length} release{releases.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {releases.map((release) => (
                <ReleaseCard
                  key={release.id}
                  release={release}
                  accentColor={artist.branding.primaryColor}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Experiences */}
      {experiences.length > 0 && (
        <section className="border-b border-[var(--color-border)]">
          <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-12 md:py-16">
            <div className="flex items-baseline justify-between mb-8">
              <h2 className="heading-editorial text-3xl text-[var(--color-fg)]">
                Featured Experiences
              </h2>
              <span className="text-sm text-[var(--color-fg-muted)]">
                {experiences.length} experience{experiences.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {experiences.map((exp) => (
                <ExperienceEntry key={exp.id} experience={exp} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Campaigns */}
      {campaigns.length > 0 && (
        <section className="border-b border-[var(--color-border)]">
          <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-12 md:py-16">
            <div className="flex items-baseline justify-between mb-8">
              <h2 className="heading-editorial text-3xl text-[var(--color-fg)]">Campaigns</h2>
              <span className="text-sm text-[var(--color-fg-muted)]">
                {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="border border-[var(--color-border)] p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant={
                            campaign.status === "active"
                              ? "accent"
                              : campaign.status === "ended"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {campaign.status}
                        </Badge>
                        {campaign.status === "active" && (
                          <span className="flex items-center gap-1 text-xs text-emerald-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            LIVE
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold">{campaign.title}</h3>
                    </div>
                  </div>

                  {campaign.branding.tagline && (
                    <p className="text-sm italic text-[var(--color-accent)] mb-3">
                      &ldquo;{campaign.branding.tagline}&rdquo;
                    </p>
                  )}

                  <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed mb-4 line-clamp-2">
                    {campaign.description}
                  </p>

                  <div className="flex gap-6 text-sm">
                    <div>
                      <span className="font-mono font-bold text-[var(--color-fg)]">
                        {formatCount(campaign.participantCount)}
                      </span>
                      <span className="text-[var(--color-fg-subtle)] ml-1.5">participants</span>
                    </div>
                    <div>
                      <span className="font-mono font-bold text-[var(--color-fg)]">
                        {formatCount(campaign.artworkCount)}
                      </span>
                      <span className="text-[var(--color-fg-subtle)] ml-1.5">artworks</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
                    <span className="text-xs text-[var(--color-fg-subtle)] italic">
                      Campaign experience — Phase 2
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Back */}
      <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-8">
        <Link
          href="/explore"
          className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          ← Back to Explore
        </Link>
      </div>
    </main>
  );
}
