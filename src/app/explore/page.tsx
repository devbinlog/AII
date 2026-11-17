// force-dynamic: lists all artists/releases/campaigns from in-memory mock adapter.
// Data is mutable at runtime; static generation not suitable in MOCK_ONLY mode.
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getRepository } from "@/lib/repository";
import { isPublicRelease } from "@/lib/public-visibility";
import { ExploreClient } from "./_components/explore-client";

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
  const allReleases = releaseResults.flatMap((r) => r.releases).filter(isPublicRelease);

  return (
    <main className="flex-1">
      {/* Page header */}
      <div className="border-b border-[var(--color-border)]" style={{ backgroundColor: "#0a0a0a" }}>
        <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-12 md:py-16">
          <p className="caption-label mb-3" style={{ color: "#e8192c" }}>
            Discover
          </p>
          <h1 className="heading-display text-[clamp(3rem,8vw,7rem)]" style={{ color: "#f5f5f0" }}>
            Explore
          </h1>
          <p className="mt-3 text-sm max-w-sm" style={{ color: "rgba(245,245,240,0.4)" }}>
            {artistResult.total} artist{artistResult.total !== 1 ? "s" : ""} ·{" "}
            {allReleases.length} release{allReleases.length !== 1 ? "s" : ""} ·{" "}
            {campaignResult.total} campaign{campaignResult.total !== 1 ? "s" : ""}
          </p>
          <div
            className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 border text-xs font-mono"
            style={{ borderColor: "rgba(228,73,66,0.3)", color: "rgba(228,73,66,0.7)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#e8192c] opacity-70" />
            DEMO DATA — All artists, releases, and campaigns are fictional
          </div>
        </div>
      </div>

      <ExploreClient
        artists={artistResult.artists}
        releases={allReleases}
        campaigns={campaignResult.campaigns}
      />
    </main>
  );
}
