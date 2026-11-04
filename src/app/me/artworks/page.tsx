export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getRepository } from "@/lib/repository";
import { getCurrentUser, getSession } from "@/lib/auth/session";
import { MyArtworksClient } from "./_components/my-artworks-client";

export const metadata: Metadata = {
  title: "My Artworks — AII",
  description: "Manage your fan artworks.",
};

export default async function MyArtworksPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?redirect=/me/artworks");
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/me/artworks");

  const repo = getRepository();
  const { artworks } = await repo.artwork.listByUser(user.id, { page: 1, pageSize: 50 });

  // Collect campaign slugs for edit links
  const campaignIds = [...new Set(artworks.map((a) => a.campaignId))];
  const campaigns = await Promise.all(campaignIds.map((id) => repo.campaign.findById(id)));
  const campaignSlugMap: Record<string, string> = {};
  for (const campaign of campaigns) {
    if (campaign) campaignSlugMap[campaign.id] = campaign.slug;
  }

  return (
    <main
      className="flex-1"
      style={{ backgroundColor: "var(--color-neutral-950)", color: "var(--color-neutral-50)" }}
    >
      {/* Header */}
      <section
        className="border-b"
        style={{ borderColor: "var(--color-neutral-800)" }}
      >
        <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-12">
          <p
            className="font-mono text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ color: "var(--color-accent)" }}
          >
            My Artworks
          </p>
          <h1
            className="text-5xl md:text-6xl font-black tracking-tight leading-none mb-3"
            style={{ color: "var(--color-neutral-50)" }}
          >
            {user.displayName}
          </h1>
          <p style={{ color: "var(--color-neutral-400)" }}>
            {artworks.length} artwork{artworks.length !== 1 ? "s" : ""} created
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-10">
        {artworks.length === 0 ? (
          <EmptyState />
        ) : (
          <MyArtworksClient
            initialArtworks={artworks}
            campaignSlugMap={campaignSlugMap}
          />
        )}
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
        style={{ backgroundColor: "var(--color-neutral-900)", border: "1px solid var(--color-neutral-800)" }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8" style={{ color: "var(--color-neutral-500)" }}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9l4.5-4.5L12 9l4.5-4.5L21 9" />
          <circle cx="12" cy="15" r="2" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--color-neutral-50)" }}>
        No artworks yet
      </h2>
      <p className="text-sm mb-8 max-w-xs" style={{ color: "var(--color-neutral-400)" }}>
        Participate in a campaign to create your first artwork.
      </p>
      <Link
        href="/campaigns/moonwave-fan-artwork"
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded"
        style={{ backgroundColor: "var(--color-accent)", color: "#fff" }}
      >
        Explore Campaigns
      </Link>
    </div>
  );
}
