// force-dynamic: lists all artists/releases/campaigns from in-memory mock adapter.
// Data is mutable at runtime; static generation not suitable in MOCK_ONLY mode.
export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import { getRepository } from "@/lib/repository";
import { isPublicRelease } from "@/lib/public-visibility";
import { formatDate } from "@/lib/utils/format";
import { ExploreClient } from "./_components/explore-client";
import { ReleaseArt } from "./_components/release-art";

export const metadata: Metadata = {
  title: "Explore",
  description: "Discover independent artists, releases, and campaigns on AII.",
};

export default async function ExplorePage() {
  const repo = getRepository();

  const [artistResult, campaignResult] = await Promise.all([
    repo.artist.list({ page: 1, pageSize: 100 }),
    repo.campaign.listPublic({ page: 1, pageSize: 100 }),
  ]);

  const releaseResults = await Promise.all(
    artistResult.artists.map((a) =>
      repo.release.listByArtist(a.id, { page: 1, pageSize: 100 })
    )
  );
  const allReleases = releaseResults
    .flatMap((r) => r.releases)
    .filter(isPublicRelease)
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));

  const artistById = new Map(artistResult.artists.map((a) => [a.id, a]));
  const cover = allReleases[0] ?? null;
  const coverArtist = cover ? artistById.get(cover.artistId) ?? null : null;
  const liveCampaign = campaignResult.campaigns.find((c) => c.status === "active") ?? null;

  return (
    <main className="flex-1">
      <header className="border-b border-[var(--color-border)] bg-[var(--aii-ink)] text-[var(--aii-paper)]">
        <div className="max-w-[var(--container-2xl)] mx-auto px-4 sm:px-6 py-10 md:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end">
          <div className="lg:col-span-7">
            <p className="caption-label mb-3 text-[var(--aii-signal)]">Discover</p>
            <h1 className="heading-display text-[clamp(3rem,8vw,6.5rem)]">Explore</h1>
            <p className="mt-4 text-sm text-[var(--aii-stone)]">
              {artistResult.total} artist{artistResult.total !== 1 ? "s" : ""} · {allReleases.length} release{allReleases.length !== 1 ? "s" : ""} ·{" "}
              {campaignResult.total} campaign{campaignResult.total !== 1 ? "s" : ""}
            </p>
            <p className="mt-5 inline-flex items-center gap-2 border border-[color:rgb(228_73_66/0.45)] px-3 py-1.5 font-mono text-xs text-[var(--aii-signal)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--aii-signal)]" aria-hidden="true" />
              DEMO DATA — All artists, releases, and campaigns are fictional
            </p>
          </div>

          {cover && (
            <aside className="lg:col-span-5" aria-label="Cover story">
              <p className="caption-label text-[var(--aii-stone)]">Cover story</p>
              <Link href={`/releases/${cover.id}`} className="group mt-3 grid grid-cols-[7rem_1fr] sm:grid-cols-[9rem_1fr] gap-5 items-end">
                <ReleaseArt color={coverArtist?.branding.primaryColor} className="w-full" />
                <span className="min-w-0">
                  <span className="block font-mono text-[11px] uppercase tracking-wider text-[var(--aii-stone)]">
                    {cover.type} · {formatDate(cover.releaseDate, { year: "numeric", month: "short" })}
                  </span>
                  <span className="mt-1 block heading-editorial text-3xl sm:text-4xl group-hover:underline underline-offset-4">{cover.title}</span>
                  {coverArtist && <span className="mt-1 block text-sm text-[var(--aii-stone)]">{coverArtist.name}</span>}
                  <span className="mt-3 block text-sm font-semibold">Listen →</span>
                </span>
              </Link>
              {liveCampaign && (
                <Link
                  href={`/campaigns/${liveCampaign.slug}`}
                  className="mt-5 flex items-center justify-between gap-4 border-t border-[color:rgb(167_165_160/0.3)] pt-4 text-sm hover:text-[var(--aii-paper)]"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--aii-signal)]" aria-hidden="true" />
                    <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--aii-stone)]">Live campaign</span>
                    <span className="truncate font-semibold">{liveCampaign.title}</span>
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              )}
            </aside>
          )}
        </div>
      </header>

      <ExploreClient
        artists={artistResult.artists}
        releases={allReleases}
        campaigns={campaignResult.campaigns}
      />
    </main>
  );
}
