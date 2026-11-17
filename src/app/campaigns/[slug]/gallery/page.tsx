// force-dynamic: pagination via ?page= query param + live mock data
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRepository } from "@/lib/repository";
import { isPublicCampaign } from "@/lib/public-visibility";
import { formatCount } from "@/lib/utils/format";
import { ArtworkGrid } from "./_components/artwork-grid";

const PAGE_SIZE = 12;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const repo = getRepository();
  const campaign = await repo.campaign.findBySlug(slug);
  if (!campaign || !isPublicCampaign(campaign)) return { title: "Gallery Not Found" };
  return {
    title: `${campaign.title} — Gallery`,
    description: `Fan artworks for the ${campaign.title} campaign.`,
  };
}

export default async function CampaignGalleryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const repo = getRepository();

  const campaign = await repo.campaign.findBySlug(slug);
  if (!campaign || !isPublicCampaign(campaign)) notFound();

  const artworkResult = await repo.artwork.listByCampaign(campaign.id, {
    page,
    pageSize: PAGE_SIZE,
  });

  // Filter: only published + public artworks
  const allArtworks = artworkResult.artworks.filter(
    (a) => a.status === "published" && a.permission === "public"
  );
  const total = allArtworks.length;
  const totalPages = Math.max(1, Math.ceil(artworkResult.total / PAGE_SIZE));

  const isActive = campaign.status === "active";
  const accentColor = campaign.branding.primaryColor;

  return (
    <main
      className="flex-1"
      style={{ backgroundColor: "var(--color-neutral-950)" }}
    >
      {/* MOCK mode banner */}
      <div
        className="border-b"
        style={{
          borderColor: "rgba(228,73,66,0.2)",
          backgroundColor: "rgba(228,73,66,0.05)",
        }}
      >
        <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-2 flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "#e8192c", opacity: 0.7 }}
          />
          <p
            className="text-xs font-mono"
            style={{ color: "rgba(228,73,66,0.7)" }}
          >
            DEMO DATA — All artworks are fictional
          </p>
        </div>
      </div>

      {/* Header */}
      <div
        className="border-b"
        style={{
          borderColor: "var(--color-neutral-800)",
          backgroundColor: "var(--color-neutral-950)",
        }}
      >
        <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-10 md:py-14">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-2 text-xs" style={{ color: "var(--color-neutral-400)" }}>
              <li>
                <Link
                  href="/explore"
                  className="hover:opacity-70 transition-opacity"
                >
                  Explore
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  href={`/campaigns/${campaign.slug}`}
                  className="hover:opacity-70 transition-opacity"
                >
                  {campaign.title}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li style={{ color: "var(--color-neutral-50)" }} aria-current="page">
                Gallery
              </li>
            </ol>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p
                className="caption-label mb-2"
                style={{ color: accentColor }}
              >
                Fan Artworks
              </p>
              <h1
                className="heading-editorial text-[clamp(2.5rem,7vw,6rem)]"
                style={{ color: "var(--color-neutral-50)" }}
              >
                Gallery
              </h1>
              <p
                className="mt-2 text-sm"
                style={{ color: "var(--color-neutral-400)" }}
              >
                {campaign.title}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p
                  className="font-mono text-3xl font-bold"
                  style={{ color: "var(--color-neutral-50)" }}
                >
                  {formatCount(campaign.artworkCount)}
                </p>
                <p
                  className="caption-label text-[10px]"
                  style={{ color: "var(--color-neutral-400)" }}
                >
                  Artworks
                </p>
              </div>
              <div
                className="w-px h-10"
                style={{ backgroundColor: "var(--color-neutral-800)" }}
                aria-hidden="true"
              />
              <div className="text-right">
                <p
                  className="font-mono text-3xl font-bold"
                  style={{ color: "var(--color-neutral-50)" }}
                >
                  {formatCount(campaign.participantCount)}
                </p>
                <p
                  className="caption-label text-[10px]"
                  style={{ color: "var(--color-neutral-400)" }}
                >
                  Participants
                </p>
              </div>
            </div>
          </div>

          {/* Create CTA */}
          {isActive && (
            <div className="mt-6">
              <Link
                href={`/campaigns/${campaign.slug}/create`}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: accentColor,
                  color: "#fff",
                }}
              >
                <svg
                  viewBox="0 0 16 16"
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="M8 2v12M2 8h12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Create Artwork
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Gallery content */}
      <div
        className="max-w-[var(--container-2xl)] mx-auto px-6 py-10 md:py-14"
        style={{ backgroundColor: "var(--color-neutral-950)" }}
      >
        {/* Sort / count info */}
        {total > 0 && (
          <div className="flex items-center justify-between mb-6">
            <p
              className="text-sm"
              style={{ color: "var(--color-neutral-400)" }}
            >
              Showing{" "}
              <span style={{ color: "var(--color-neutral-50)" }}>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}
              </span>{" "}
              of{" "}
              <span style={{ color: "var(--color-neutral-50)" }}>
                {total}
              </span>{" "}
              public artworks
            </p>
            <p
              className="text-xs font-mono"
              style={{ color: "var(--color-neutral-400)" }}
            >
              Newest first
            </p>
          </div>
        )}

        {/* Grid */}
        <ArtworkGrid artworks={allArtworks} accentColor={accentColor} />

        {/* Pagination */}
        {totalPages > 1 && (
          <nav
            className="flex items-center justify-between mt-12 pt-6 border-t"
            style={{ borderColor: "var(--color-neutral-800)" }}
            aria-label="Pagination"
          >
            {page > 1 ? (
              <Link
                href={`/campaigns/${campaign.slug}/gallery?page=${page - 1}`}
                className="flex items-center gap-2 px-4 py-2 border text-sm transition-all hover:opacity-70"
                style={{
                  borderColor: "var(--color-neutral-700)",
                  color: "var(--color-neutral-50)",
                }}
                rel="prev"
              >
                <svg
                  viewBox="0 0 16 16"
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="M10 4L6 8l4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Previous
              </Link>
            ) : (
              <span
                className="flex items-center gap-2 px-4 py-2 border text-sm opacity-30 cursor-not-allowed"
                style={{
                  borderColor: "var(--color-neutral-700)",
                  color: "var(--color-neutral-50)",
                }}
                aria-disabled="true"
              >
                <svg
                  viewBox="0 0 16 16"
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="M10 4L6 8l4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Previous
              </span>
            )}

            <p
              className="text-sm font-mono"
              style={{ color: "var(--color-neutral-400)" }}
              aria-label={`Page ${page} of ${totalPages}`}
            >
              {page} / {totalPages}
            </p>

            {page < totalPages ? (
              <Link
                href={`/campaigns/${campaign.slug}/gallery?page=${page + 1}`}
                className="flex items-center gap-2 px-4 py-2 border text-sm transition-all hover:opacity-70"
                style={{
                  borderColor: "var(--color-neutral-700)",
                  color: "var(--color-neutral-50)",
                }}
                rel="next"
              >
                Next
                <svg
                  viewBox="0 0 16 16"
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ) : (
              <span
                className="flex items-center gap-2 px-4 py-2 border text-sm opacity-30 cursor-not-allowed"
                style={{
                  borderColor: "var(--color-neutral-700)",
                  color: "var(--color-neutral-50)",
                }}
                aria-disabled="true"
              >
                Next
                <svg
                  viewBox="0 0 16 16"
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
          </nav>
        )}

        {/* Empty state with create CTA */}
        {total === 0 && isActive && (
          <div className="mt-8 text-center">
            <Link
              href={`/campaigns/${campaign.slug}/create`}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{
                backgroundColor: accentColor,
                color: "#fff",
              }}
            >
              Be the first — Create Artwork
            </Link>
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div
        className="border-t"
        style={{
          borderColor: "var(--color-neutral-800)",
          backgroundColor: "var(--color-neutral-950)",
        }}
      >
        <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-6 flex justify-between items-center">
          <Link
            href={`/campaigns/${campaign.slug}`}
            className="text-sm hover:opacity-70 transition-opacity"
            style={{ color: "var(--color-neutral-400)" }}
          >
            ← Back to Campaign
          </Link>
          {isActive && (
            <Link
              href={`/campaigns/${campaign.slug}/create`}
              className="text-sm hover:opacity-70 transition-opacity"
              style={{ color: accentColor }}
            >
              Create Artwork →
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
