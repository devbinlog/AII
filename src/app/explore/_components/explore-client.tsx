"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import type { Artist, Release, Campaign } from "@/types";
import { Badge } from "@/components/ui/badge";
import { formatCount, formatDate } from "@/lib/utils/format";

interface ExploreClientProps {
  artists: Artist[];
  releases: Release[];
  campaigns: Campaign[];
}

type Tab = "artists" | "releases" | "campaigns";

function ArtistCoverPlaceholder({ name, primaryColor }: { name: string; primaryColor: string }) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div
      className="aspect-square relative overflow-hidden"
      style={{ backgroundColor: "#0a0a0a" }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 300 300" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <rect width="300" height="300" fill="#0a0a0a" />
        {Array.from({ length: 6 }).map((_, i) => (
          <rect
            key={i}
            x={i * 50}
            y="0"
            width="1"
            height="300"
            fill={primaryColor}
            opacity={0.15 - i * 0.02}
          />
        ))}
        <circle cx="150" cy="150" r="100" fill="none" stroke={primaryColor} strokeWidth="0.5" opacity="0.3" />
        <circle cx="150" cy="150" r="60" fill={primaryColor} opacity="0.08" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="heading-display text-4xl"
          style={{ color: primaryColor, opacity: 0.6 }}
        >
          {initials}
        </span>
      </div>
    </div>
  );
}

function ReleaseCoverPlaceholder({ color = "#e8192c" }: { color?: string }) {
  return (
    <div
      className="aspect-square relative overflow-hidden shrink-0"
      style={{ backgroundColor: "#0a0a0a", width: 64, height: 64 }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" fill="#0a0a0a" />
        <circle cx="32" cy="32" r="28" fill="none" stroke={color} strokeWidth="0.5" opacity="0.4" />
        <circle cx="32" cy="32" r="14" fill="none" stroke={color} strokeWidth="0.5" opacity="0.6" />
        <circle cx="32" cy="32" r="4" fill={color} opacity="0.3" />
      </svg>
    </div>
  );
}

function ArtistCard({ artist }: { artist: Artist }) {
  return (
    <Link
      href={`/artists/${artist.slug}`}
      className="group block border border-[var(--color-border)] hover:border-[var(--color-fg)] transition-all"
    >
      <ArtistCoverPlaceholder
        name={artist.name}
        primaryColor={artist.branding.primaryColor}
      />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="heading-editorial text-xl group-hover:text-[var(--color-accent)] transition-colors leading-tight">
            {artist.name}
          </h3>
          {artist.isVerified && (
            <span
              className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center mt-0.5"
              style={{ backgroundColor: "#e8192c" }}
              title="Verified artist"
            >
              <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="white">
                <path d="M2 6l3 3 5-5" strokeWidth="1.5" stroke="white" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {artist.genre.slice(0, 3).map((g) => (
            <Badge key={g} variant="outline" className="text-xs">
              {g}
            </Badge>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-fg-muted)]">
            {formatCount(artist.followerCount)} followers
          </span>
          <Badge
            variant={artist.status === "active" ? "accent" : "secondary"}
            className="text-xs"
          >
            {artist.status}
          </Badge>
        </div>
      </div>
    </Link>
  );
}

function ReleaseRow({ release }: { release: Release }) {
  return (
    <Link
      href={`/releases/${release.id}`}
      className="group flex items-center gap-4 py-4 border-b border-[var(--color-border)] hover:border-[var(--color-fg-muted)] transition-colors"
    >
      <ReleaseCoverPlaceholder />
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold group-hover:text-[var(--color-accent)] transition-colors truncate">
          {release.title}
        </h3>
        <p className="text-xs text-[var(--color-fg-muted)] mt-0.5 truncate">
          {release.description}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-4 text-right">
        <div className="hidden sm:block">
          <Badge variant="outline">{release.type}</Badge>
        </div>
        <div>
          <p className="text-xs text-[var(--color-fg-muted)]">
            {formatDate(release.releaseDate, { year: "numeric", month: "short" })}
          </p>
          <p className="text-xs text-[var(--color-fg-subtle)] mt-0.5">
            {release.tracks.length} tracks
          </p>
        </div>
      </div>
    </Link>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const isActive = campaign.status === "active";
  const endsAt = campaign.endsAt ? new Date(campaign.endsAt) : null;

  return (
    <div className="border border-[var(--color-border)] p-5">
      <div className="flex items-start justify-between gap-2 mb-4">
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
            {isActive && (
              <span className="flex items-center gap-1 text-xs text-emerald-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <h3 className="heading-editorial text-xl leading-tight">{campaign.title}</h3>
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

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[var(--color-bg-secondary)] px-3 py-2">
          <p className="font-mono text-lg font-bold text-[var(--color-fg)]">
            {formatCount(campaign.participantCount)}
          </p>
          <p className="caption-label text-[var(--color-fg-subtle)] text-[10px] mt-0.5">
            Participants
          </p>
        </div>
        <div className="bg-[var(--color-bg-secondary)] px-3 py-2">
          <p className="font-mono text-lg font-bold text-[var(--color-fg)]">
            {formatCount(campaign.artworkCount)}
          </p>
          <p className="caption-label text-[var(--color-fg-subtle)] text-[10px] mt-0.5">
            Artworks
          </p>
        </div>
      </div>

      {endsAt && (
        <p className="text-xs text-[var(--color-fg-subtle)]">
          {isActive ? "Ends" : "Ended"}{" "}
          {formatDate(endsAt.toISOString(), { year: "numeric", month: "short", day: "numeric" })}
        </p>
      )}

      <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
        <span
          className="text-xs text-[var(--color-fg-subtle)] italic"
          title="Campaign experience — coming in Phase 2"
        >
          Campaign experience — Phase 2
        </span>
      </div>
    </div>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const messages: Record<Tab, string> = {
    artists: "No artists match your search.",
    releases: "No releases match your search.",
    campaigns: "No campaigns match your search.",
  };
  return (
    <div className="py-20 text-center">
      <p className="text-[var(--color-fg-subtle)] text-sm">{messages[tab]}</p>
    </div>
  );
}

export function ExploreClient({ artists, releases, campaigns }: ExploreClientProps) {
  const [tab, setTab] = useState<Tab>("artists");
  const [search, setSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [selectedReleaseType, setSelectedReleaseType] = useState<string>("");
  const [selectedCampaignStatus, setSelectedCampaignStatus] = useState<string>("");

  const filteredArtists = useMemo(() => {
    let result = artists;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.bio.toLowerCase().includes(q) ||
          a.genre.some((g) => g.toLowerCase().includes(q))
      );
    }
    if (selectedGenre) {
      result = result.filter((a) => a.genre.includes(selectedGenre));
    }
    return result;
  }, [artists, search, selectedGenre]);

  const filteredReleases = useMemo(() => {
    let result = releases;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
      );
    }
    if (selectedReleaseType) {
      result = result.filter((r) => r.type === selectedReleaseType);
    }
    return result;
  }, [releases, search, selectedReleaseType]);

  const filteredCampaigns = useMemo(() => {
    let result = campaigns;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
      );
    }
    if (selectedCampaignStatus) {
      result = result.filter((c) => c.status === selectedCampaignStatus);
    }
    return result;
  }, [campaigns, search, selectedCampaignStatus]);

  const availableGenres = useMemo(() => {
    const genres = new Set<string>();
    artists.forEach((a) => a.genre.forEach((g) => genres.add(g)));
    return Array.from(genres).sort();
  }, [artists]);

  const releaseTypes = ["single", "ep", "album", "compilation"];
  const campaignStatuses = ["active", "scheduled", "ended"];

  const counts = {
    artists: filteredArtists.length,
    releases: filteredReleases.length,
    campaigns: filteredCampaigns.length,
  };

  return (
    <div>
      {/* Search bar */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-4">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-fg-subtle)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${tab}...`}
              className="w-full pl-10 pr-4 h-10 bg-transparent border border-[var(--color-border)] text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:border-[var(--color-fg)] transition-colors"
              aria-label={`Search ${tab}`}
            />
          </div>
        </div>
      </div>

      {/* Tabs + Filters */}
      <div className="border-b border-[var(--color-border)] sticky top-14 z-10 bg-[var(--color-bg)]">
        <div className="max-w-[var(--container-2xl)] mx-auto px-6">
          <div className="flex items-center gap-0 -mb-px overflow-x-auto">
            {(["artists", "releases", "campaigns"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`shrink-0 flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                  tab === t
                    ? "border-[var(--color-accent)] text-[var(--color-fg)]"
                    : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                }`}
                aria-current={tab === t ? "page" : undefined}
              >
                {t}
                <span
                  className={`inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-mono min-w-[1.25rem] ${
                    tab === t
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-[var(--color-border)] text-[var(--color-fg-muted)]"
                  }`}
                >
                  {counts[t]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-3 flex items-center gap-2 overflow-x-auto">
          {tab === "artists" && (
            <>
              <span className="caption-label text-[var(--color-fg-subtle)] shrink-0 mr-1">Genre:</span>
              <button
                onClick={() => setSelectedGenre("")}
                className={`shrink-0 text-xs px-3 py-1 border transition-colors ${
                  selectedGenre === ""
                    ? "border-[var(--color-fg)] bg-[var(--color-fg)] text-[var(--color-bg)]"
                    : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-fg-muted)]"
                }`}
              >
                All
              </button>
              {availableGenres.map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGenre(g === selectedGenre ? "" : g)}
                  className={`shrink-0 text-xs px-3 py-1 border capitalize transition-colors ${
                    selectedGenre === g
                      ? "border-[var(--color-fg)] bg-[var(--color-fg)] text-[var(--color-bg)]"
                      : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-fg-muted)]"
                  }`}
                >
                  {g}
                </button>
              ))}
            </>
          )}

          {tab === "releases" && (
            <>
              <span className="caption-label text-[var(--color-fg-subtle)] shrink-0 mr-1">Type:</span>
              <button
                onClick={() => setSelectedReleaseType("")}
                className={`shrink-0 text-xs px-3 py-1 border transition-colors ${
                  selectedReleaseType === ""
                    ? "border-[var(--color-fg)] bg-[var(--color-fg)] text-[var(--color-bg)]"
                    : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-fg-muted)]"
                }`}
              >
                All
              </button>
              {releaseTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedReleaseType(t === selectedReleaseType ? "" : t)}
                  className={`shrink-0 text-xs px-3 py-1 border capitalize transition-colors ${
                    selectedReleaseType === t
                      ? "border-[var(--color-fg)] bg-[var(--color-fg)] text-[var(--color-bg)]"
                      : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-fg-muted)]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </>
          )}

          {tab === "campaigns" && (
            <>
              <span className="caption-label text-[var(--color-fg-subtle)] shrink-0 mr-1">Status:</span>
              <button
                onClick={() => setSelectedCampaignStatus("")}
                className={`shrink-0 text-xs px-3 py-1 border transition-colors ${
                  selectedCampaignStatus === ""
                    ? "border-[var(--color-fg)] bg-[var(--color-fg)] text-[var(--color-bg)]"
                    : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-fg-muted)]"
                }`}
              >
                All
              </button>
              {campaignStatuses.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedCampaignStatus(s === selectedCampaignStatus ? "" : s)}
                  className={`shrink-0 text-xs px-3 py-1 border capitalize transition-colors ${
                    selectedCampaignStatus === s
                      ? "border-[var(--color-fg)] bg-[var(--color-fg)] text-[var(--color-bg)]"
                      : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-fg-muted)]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-8">
        {tab === "artists" && (
          filteredArtists.length === 0 ? (
            <EmptyState tab="artists" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredArtists.map((artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </div>
          )
        )}

        {tab === "releases" && (
          filteredReleases.length === 0 ? (
            <EmptyState tab="releases" />
          ) : (
            <div>
              <div className="flex items-center gap-4 pb-3 border-b border-[var(--color-border)] mb-1">
                <span className="w-16 shrink-0" />
                <span className="caption-label text-[var(--color-fg-subtle)] flex-1">Title</span>
                <span className="caption-label text-[var(--color-fg-subtle)] hidden sm:block w-16 text-center">Type</span>
                <span className="caption-label text-[var(--color-fg-subtle)] w-20 text-right">Release</span>
              </div>
              {filteredReleases.map((release) => (
                <ReleaseRow key={release.id} release={release} />
              ))}
            </div>
          )
        )}

        {tab === "campaigns" && (
          filteredCampaigns.length === 0 ? (
            <EmptyState tab="campaigns" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
