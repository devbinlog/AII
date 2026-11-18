"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import type { Artist, Release, Campaign } from "@/types";
import { formatCount, formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { ReleaseArt } from "./release-art";

interface ExploreClientProps {
  artists: Artist[];
  releases: Release[];
  campaigns: Campaign[];
}

type Tab = "artists" | "releases" | "campaigns";

/** Artist-owned cover: drawn only in the artist's branding colours. */
function ArtistCover({ artist, className = "" }: { artist: Artist; className?: string }) {
  const { primaryColor, backgroundColor, accentColor } = artist.branding;
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ backgroundColor }} aria-hidden="true">
      <svg viewBox="0 0 300 300" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
        {Array.from({ length: 7 }).map((_, i) => (
          <rect key={i} x={i * 50} y="0" width="1" height="300" fill={primaryColor} opacity={0.18 - i * 0.02} />
        ))}
        <circle cx="190" cy="120" r="90" fill="none" stroke={primaryColor} strokeWidth="0.8" opacity="0.5" />
        <circle cx="190" cy="120" r="44" fill={primaryColor} opacity="0.16" />
      </svg>
      <span className="absolute left-4 bottom-3 heading-display text-[clamp(2rem,4vw,3.5rem)] leading-none" style={{ color: accentColor }}>
        {artist.name.slice(0, 2)}
      </span>
    </div>
  );
}

function GenreLine({ genres }: { genres: string[] }) {
  const [primary, ...rest] = genres;
  if (!primary) return null;
  return (
    <p className="text-xs uppercase tracking-wider">
      <span className="font-semibold text-[var(--color-fg)]">{primary}</span>
      {rest.length > 0 && <span className="text-[var(--color-fg-muted)]"> · {rest.join(" · ")}</span>}
    </p>
  );
}

function VerifiedMark() {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)]" title="Verified artist">
      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
        <circle cx="6" cy="6" r="6" fill="var(--aii-ink)" />
        <path d="M3 6.2l2 2 4-4" stroke="var(--aii-paper)" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Verified
    </span>
  );
}

/** First result: a wide editorial card with bio excerpt and direct links. */
function FeatureArtistCard({ artist, latest }: { artist: Artist; latest: Release | undefined }) {
  return (
    <article className="group grid grid-cols-1 sm:grid-cols-2 border border-[var(--color-border)] hover:border-[var(--color-fg)] transition-colors">
      <Link href={`/artists/${artist.slug}`} tabIndex={-1} aria-hidden="true">
        <ArtistCover artist={artist} className="aspect-[4/3] sm:aspect-auto sm:h-full min-h-[14rem]" />
      </Link>
      <div className="flex flex-col p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <GenreLine genres={artist.genre} />
          {artist.isVerified && <VerifiedMark />}
        </div>
        <h3 className="heading-editorial mt-3 text-4xl">
          <Link href={`/artists/${artist.slug}`} className="hover:underline underline-offset-4">
            {artist.name}
          </Link>
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-fg-muted)] line-clamp-3">{artist.bio}</p>
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--color-border)] pt-4 text-sm">
          <div>
            <dt className="caption-label text-[var(--color-fg-muted)]">Followers</dt>
            <dd className="font-mono font-bold tabular-nums">{formatCount(artist.followerCount)}</dd>
          </div>
          {latest && (
            <div className="min-w-0">
              <dt className="caption-label text-[var(--color-fg-muted)]">Latest</dt>
              <dd className="truncate font-semibold">{latest.title}</dd>
            </div>
          )}
        </dl>
        <div className="mt-auto pt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
          <Link href={`/artists/${artist.slug}`} className="underline underline-offset-4 hover:text-[var(--color-accent)]">
            Artist profile →
          </Link>
          {latest && (
            <Link href={`/releases/${latest.id}`} className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
              Listen to {latest.title}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function ArtistCard({ artist }: { artist: Artist }) {
  return (
    <Link href={`/artists/${artist.slug}`} className="group block border border-[var(--color-border)] hover:border-[var(--color-fg)] transition-colors">
      <ArtistCover artist={artist} className="aspect-[4/3]" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="heading-editorial text-xl leading-tight group-hover:underline underline-offset-4">{artist.name}</h3>
          {artist.isVerified && <VerifiedMark />}
        </div>
        <div className="mt-2">
          <GenreLine genres={artist.genre.slice(0, 3)} />
        </div>
        <p className="mt-3 text-xs text-[var(--color-fg-muted)]">{formatCount(artist.followerCount)} followers</p>
      </div>
    </Link>
  );
}

function ReleaseRow({ release, artist }: { release: Release; artist: Artist | undefined }) {
  return (
    <Link
      href={`/releases/${release.id}`}
      className="group grid grid-cols-[4rem_1fr_auto] sm:grid-cols-[4.5rem_1fr_5rem_7rem] items-center gap-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors"
    >
      <ReleaseArt color={artist?.branding.primaryColor} className="w-16 sm:w-[4.5rem]" />
      <div className="min-w-0">
        <h3 className="text-base font-semibold truncate group-hover:underline underline-offset-4">{release.title}</h3>
        <p className="text-xs text-[var(--color-fg-muted)] truncate">
          {artist?.name}
          {artist && " · "}
          {release.description}
        </p>
      </div>
      <span className="hidden sm:block text-center text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">{release.type}</span>
      <div className="text-right">
        <p className="text-xs text-[var(--color-fg)]">{formatDate(release.releaseDate, { year: "numeric", month: "short" })}</p>
        <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">{release.tracks.length} tracks</p>
      </div>
    </Link>
  );
}

function CampaignStatus({ status }: { status: Campaign["status"] }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)]">
      <span className={cn("h-1.5 w-1.5 rounded-full", status === "active" ? "bg-[var(--aii-signal-deep)]" : "bg-[var(--aii-stone)]")} aria-hidden="true" />
      {status === "active" ? "Live" : status}
    </span>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const isActive = campaign.status === "active";
  return (
    <article className="flex flex-col border border-[var(--color-border)] p-5 hover:border-[var(--color-fg)] transition-colors">
      <CampaignStatus status={campaign.status} />
      <h3 className="heading-editorial mt-3 text-2xl leading-tight">
        <Link href={`/campaigns/${campaign.slug}`} className="hover:underline underline-offset-4">
          {campaign.title}
        </Link>
      </h3>
      {campaign.branding.tagline && <p className="mt-1 text-sm italic text-[var(--color-fg-muted)]">&ldquo;{campaign.branding.tagline}&rdquo;</p>}
      <p className="mt-3 text-sm leading-relaxed text-[var(--color-fg-muted)] line-clamp-2">{campaign.description}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="bg-[var(--color-bg-secondary)] px-3 py-2">
          <dt className="caption-label text-[var(--color-fg-muted)] text-[11px]">Participants</dt>
          <dd className="font-mono text-lg font-bold tabular-nums">{formatCount(campaign.participantCount)}</dd>
        </div>
        <div className="bg-[var(--color-bg-secondary)] px-3 py-2">
          <dt className="caption-label text-[var(--color-fg-muted)] text-[11px]">Artworks</dt>
          <dd className="font-mono text-lg font-bold tabular-nums">{formatCount(campaign.artworkCount)}</dd>
        </div>
      </dl>
      {campaign.endsAt && (
        <p className="mt-3 text-xs text-[var(--color-fg-muted)]">
          {isActive ? "Ends" : "Ended"} {formatDate(campaign.endsAt)}
        </p>
      )}
      <div className="mt-auto pt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--color-border)] text-sm font-semibold mt-4">
        {isActive && (
          <Link href={`/campaigns/${campaign.slug}/experience`} className="text-[var(--color-accent)] hover:underline underline-offset-4">
            Enter the experience →
          </Link>
        )}
        <Link href={`/campaigns/${campaign.slug}/gallery`} className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
          Gallery
        </Link>
      </div>
    </article>
  );
}

function EmptyState({ tab, onReset }: { tab: Tab; onReset: () => void }) {
  const messages: Record<Tab, string> = {
    artists: "No artists match your search.",
    releases: "No releases match your search.",
    campaigns: "No campaigns match your search.",
  };
  return (
    <div className="py-16 text-center border border-dashed border-[var(--color-border-strong)]" role="status">
      <p className="text-[var(--color-fg)] font-semibold">{messages[tab]}</p>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">Try a different name, genre or type.</p>
      <button type="button" onClick={onReset} className="mt-4 text-sm font-semibold underline underline-offset-4 hover:text-[var(--color-accent)]">
        Clear search and filters
      </button>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 h-9 px-3 text-xs font-medium border capitalize transition-colors",
        active
          ? "border-[var(--color-fg)] bg-[var(--color-fg)] text-[var(--color-bg)]"
          : "border-[var(--color-border-strong)] text-[var(--color-fg-muted)] hover:border-[var(--color-fg)] hover:text-[var(--color-fg)]"
      )}
    >
      {children}
    </button>
  );
}

export function ExploreClient({ artists, releases, campaigns }: ExploreClientProps) {
  const [tab, setTab] = useState<Tab>("artists");
  const [search, setSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [selectedReleaseType, setSelectedReleaseType] = useState<string>("");
  const [selectedCampaignStatus, setSelectedCampaignStatus] = useState<string>("");

  const artistById = useMemo(() => new Map(artists.map((a) => [a.id, a])), [artists]);
  const latestByArtist = useMemo(() => {
    const m = new Map<string, Release>();
    for (const r of releases) if (!m.has(r.artistId)) m.set(r.artistId, r); // releases arrive newest first
    return m;
  }, [releases]);

  const q = search.trim().toLowerCase();

  const filteredArtists = useMemo(
    () =>
      artists.filter(
        (a) =>
          (!q || a.name.toLowerCase().includes(q) || a.bio.toLowerCase().includes(q) || a.genre.some((g) => g.toLowerCase().includes(q))) &&
          (!selectedGenre || a.genre.includes(selectedGenre))
      ),
    [artists, q, selectedGenre]
  );

  const filteredReleases = useMemo(
    () =>
      releases.filter(
        (r) =>
          (!q || r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || (artistById.get(r.artistId)?.name.toLowerCase().includes(q) ?? false)) &&
          (!selectedReleaseType || r.type === selectedReleaseType)
      ),
    [releases, q, selectedReleaseType, artistById]
  );

  const filteredCampaigns = useMemo(
    () =>
      campaigns.filter(
        (c) => (!q || c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)) && (!selectedCampaignStatus || c.status === selectedCampaignStatus)
      ),
    [campaigns, q, selectedCampaignStatus]
  );

  const availableGenres = useMemo(() => {
    const genres = new Set<string>();
    artists.forEach((a) => a.genre.forEach((g) => genres.add(g)));
    return Array.from(genres).sort();
  }, [artists]);

  const releaseTypes = ["single", "ep", "album", "compilation"];
  const campaignStatuses = ["active", "scheduled", "ended"];

  const counts = { artists: filteredArtists.length, releases: filteredReleases.length, campaigns: filteredCampaigns.length };
  const resetFilters = () => {
    setSearch("");
    setSelectedGenre("");
    setSelectedReleaseType("");
    setSelectedCampaignStatus("");
  };

  const filters: { label: string; options: string[]; value: string; set: (v: string) => void } =
    tab === "artists"
      ? { label: "Genre", options: availableGenres, value: selectedGenre, set: setSelectedGenre }
      : tab === "releases"
        ? { label: "Type", options: releaseTypes, value: selectedReleaseType, set: setSelectedReleaseType }
        : { label: "Status", options: campaignStatuses, value: selectedCampaignStatus, set: setSelectedCampaignStatus };

  const liveCampaign = campaigns.find((c) => c.status === "active");
  const [featured, ...otherArtists] = filteredArtists;

  return (
    <div>
      {/* One sticky toolbar: tabs + search, then filters */}
      <div className="sticky top-14 z-10 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur-sm">
        <div className="max-w-[var(--container-2xl)] mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-6 pt-2 md:pt-0">
            <div className="flex items-center -mb-px overflow-x-auto order-2 md:order-1" role="group" aria-label="Content type">
              {(["artists", "releases", "campaigns"] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    "shrink-0 flex items-center gap-2 px-3 sm:px-4 h-12 text-sm font-medium border-b-2 transition-colors capitalize",
                    tab === t ? "border-[var(--color-fg)] text-[var(--color-fg)]" : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                  )}
                  aria-pressed={tab === t}
                >
                  {t}
                  <span
                    className={cn(
                      "inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-mono min-w-[1.25rem]",
                      tab === t ? "bg-[var(--color-fg)] text-[var(--color-bg)]" : "bg-[var(--color-bg-secondary)] text-[var(--color-fg-muted)]"
                    )}
                  >
                    {counts[t]}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative order-1 md:order-2 md:w-80">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-fg-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${tab}…`}
                className="w-full pl-10 pr-4 h-10 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-muted)] focus:outline-none focus:border-[var(--color-fg)] transition-colors"
                aria-label={`Search ${tab}`}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto py-2.5 border-t border-[var(--color-border)]" role="group" aria-label={`Filter by ${filters.label.toLowerCase()}`}>
            <span className="caption-label text-[var(--color-fg-muted)] shrink-0 mr-1">{filters.label}</span>
            <Chip active={filters.value === ""} onClick={() => filters.set("")}>
              All
            </Chip>
            {filters.options.map((o) => (
              <Chip key={o} active={filters.value === o} onClick={() => filters.set(o === filters.value ? "" : o)}>
                {o}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[var(--container-2xl)] mx-auto px-4 sm:px-6 py-8 md:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
        <section className={tab === "artists" ? "lg:col-span-8" : "lg:col-span-12"} aria-label="Results">
          {tab === "artists" &&
            (!featured ? (
              <EmptyState tab="artists" onReset={resetFilters} />
            ) : (
              <div className="flex flex-col gap-4">
                <FeatureArtistCard artist={featured} latest={latestByArtist.get(featured.id)} />
                {otherArtists.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {otherArtists.map((artist) => (
                      <ArtistCard key={artist.id} artist={artist} />
                    ))}
                  </div>
                )}
              </div>
            ))}

          {tab === "releases" &&
            (filteredReleases.length === 0 ? (
              <EmptyState tab="releases" onReset={resetFilters} />
            ) : (
              <div className="border-t border-[var(--color-fg)]">
                {filteredReleases.map((release) => (
                  <ReleaseRow key={release.id} release={release} artist={artistById.get(release.artistId)} />
                ))}
              </div>
            ))}

          {tab === "campaigns" &&
            (filteredCampaigns.length === 0 ? (
              <EmptyState tab="campaigns" onReset={resetFilters} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCampaigns.map((campaign) => (
                  <CampaignCard key={campaign.id} campaign={campaign} />
                ))}
              </div>
            ))}
        </section>

        {tab === "artists" && (
          <aside className="lg:col-span-4 flex flex-col gap-8" aria-label="Around the roster">
            {releases.length > 0 && (
              <div>
                <h2 className="caption-label text-[var(--color-fg-muted)] border-b border-[var(--color-fg)] pb-2">Latest releases</h2>
                <ul>
                  {releases.slice(0, 4).map((r) => (
                    <li key={r.id}>
                      <Link href={`/releases/${r.id}`} className="group grid grid-cols-[3rem_1fr] items-center gap-3 border-b border-[var(--color-border)] py-3">
                        <ReleaseArt color={artistById.get(r.artistId)?.branding.primaryColor} className="w-12" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold group-hover:underline underline-offset-4">{r.title}</span>
                          <span className="block truncate text-xs text-[var(--color-fg-muted)]">
                            {r.type.toUpperCase()} · {formatDate(r.releaseDate, { year: "numeric", month: "short" })}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {liveCampaign && (
              <div className="bg-[var(--aii-ink)] p-5 text-[var(--aii-paper)]">
                <p className="caption-label text-[var(--aii-stone)]">Live campaign</p>
                <p className="heading-editorial mt-2 text-2xl">{liveCampaign.title}</p>
                <p className="mt-1 text-xs text-[var(--aii-stone)]">
                  {formatCount(liveCampaign.participantCount)} participants · {formatCount(liveCampaign.artworkCount)} artworks
                </p>
                <Link href={`/campaigns/${liveCampaign.slug}/experience`} className="mt-4 inline-block text-sm font-semibold text-[var(--aii-signal)] hover:underline underline-offset-4">
                  Enter the experience →
                </Link>
              </div>
            )}
            <p className="border-t border-[var(--color-border)] pt-4 text-xs leading-relaxed text-[var(--color-fg-muted)]">
              The AII roster is invite-only during the MVP. Everything listed here is demo data.
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}
