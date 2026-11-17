// force-dynamic: slug-based lookup uses getRepository() which returns in-memory mock data.
// Static params cannot be determined at build time in MOCK_ONLY mode.
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRepository } from "@/lib/repository";
import { isPublicCampaign } from "@/lib/public-visibility";
import { formatCount } from "@/lib/utils/format";
import { CampaignHero } from "./_components/campaign-hero";
import { CampaignMeta } from "./_components/campaign-meta";
import { ShareButton } from "./_components/share-button";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const repo = getRepository();
  const campaign = await repo.campaign.findBySlug(slug);
  if (!campaign || !isPublicCampaign(campaign)) return { title: "Campaign Not Found" };
  return {
    title: campaign.title,
    description: campaign.description,
  };
}

function ArtworkPreviewPlaceholder({ index, accentColor }: { index: number; accentColor: string }) {
  return (
    <div
      className="aspect-square relative overflow-hidden"
      style={{ backgroundColor: "#111111" }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#111111" />
        <circle
          cx={100 + Math.sin(index * 1.4) * 40}
          cy={100 + Math.cos(index * 1.4) * 30}
          r="70"
          fill="none"
          stroke={accentColor}
          strokeWidth="0.5"
          opacity="0.4"
        />
        <circle cx="100" cy="100" r="40" fill={accentColor} opacity="0.06" />
        <line
          x1={20 + index * 10}
          y1="200"
          x2={100 + index * 8}
          y2="0"
          stroke={accentColor}
          strokeWidth="0.5"
          opacity="0.15"
        />
      </svg>
      <div
        className="absolute bottom-0 left-0 right-0 p-2"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}
      >
        <p className="text-xs font-mono" style={{ color: "rgba(245,245,240,0.5)" }}>
          Fan Artwork #{index + 1}
        </p>
      </div>
    </div>
  );
}

export default async function CampaignLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const repo = getRepository();

  const campaign = await repo.campaign.findBySlug(slug);
  if (!campaign || !isPublicCampaign(campaign)) notFound();

  const isViewable = campaign.status === "active" || campaign.status === "scheduled";

  if (!isViewable) {
    return (
      <main
        className="flex-1 flex items-center justify-center"
        style={{ backgroundColor: "var(--color-neutral-950)" }}
      >
        <div className="text-center px-6">
          <p
            className="caption-label mb-3"
            style={{ color: "var(--color-neutral-400)" }}
          >
            Campaign
          </p>
          <h1
            className="heading-editorial text-4xl mb-4"
            style={{ color: "var(--color-neutral-50)" }}
          >
            Campaign Not Active
          </h1>
          <p
            className="text-sm mb-8"
            style={{ color: "var(--color-neutral-400)" }}
          >
            This campaign is currently <strong style={{ color: "var(--color-neutral-50)" }}>{campaign.status}</strong> and not accepting participation.
          </p>
          <Link
            href="/explore"
            className="text-sm underline underline-offset-4"
            style={{ color: "var(--color-accent)" }}
          >
            ← Back to Explore
          </Link>
        </div>
      </main>
    );
  }

  const [artistResult, experienceResult, artworkResult] = await Promise.all([
    repo.artist.findById(campaign.artistId),
    repo.experience.findById(campaign.experienceId),
    repo.artwork.listByCampaign(campaign.id, { page: 1, pageSize: 6 }),
  ]);

  const artist = artistResult;
  const experience = experienceResult;
  const previewArtworks = artworkResult.artworks.filter(
    (a) => a.status === "published" && a.permission === "public"
  );

  if (!artist || !experience) notFound();

  const isActive = campaign.status === "active";

  return (
    <main
      className="flex-1"
      style={{ backgroundColor: "var(--color-neutral-950)" }}
    >
      {/* MOCK mode banner */}
      <div
        className="border-b"
        style={{
          borderColor: "rgba(232,25,44,0.2)",
          backgroundColor: "rgba(232,25,44,0.05)",
        }}
      >
        <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-2 flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "#e8192c", opacity: 0.7 }}
          />
          <p
            className="text-xs font-mono"
            style={{ color: "rgba(232,25,44,0.7)" }}
          >
            DEMO DATA — This campaign and all data are fictional
          </p>
        </div>
      </div>

      {/* Hero */}
      <CampaignHero campaign={campaign} artist={artist} experience={experience} />

      {/* Meta / Details */}
      <CampaignMeta campaign={campaign} artist={artist} experience={experience} />

      {/* Experience preview */}
      <section
        className="border-b"
        style={{
          borderColor: "var(--color-neutral-800)",
          backgroundColor: "var(--color-neutral-950)",
        }}
        aria-labelledby="experience-section-title"
      >
        <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-12 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-3">
              <p
                className="caption-label"
                style={{ color: "var(--color-neutral-400)" }}
              >
                The Experience
              </p>
            </div>
            <div className="md:col-span-9">
              <h2
                id="experience-section-title"
                className="heading-editorial text-3xl mb-4"
                style={{ color: "var(--color-neutral-50)" }}
              >
                {experience.title}
              </h2>
              <p
                className="text-base leading-relaxed mb-6 max-w-2xl"
                style={{ color: "var(--color-neutral-400)" }}
              >
                {experience.description}
              </p>

              {/* Editable parameters preview */}
              {experience.editableParameters.length > 0 && (
                <div className="mb-8">
                  <p
                    className="caption-label text-[10px] mb-3"
                    style={{ color: "var(--color-neutral-400)" }}
                  >
                    What you can customize
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {experience.editableParameters.map((param) => (
                      <span
                        key={param.id}
                        className="text-xs px-3 py-1 border font-mono"
                        style={{
                          borderColor: "var(--color-neutral-700)",
                          color: "var(--color-neutral-400)",
                          backgroundColor: "var(--color-neutral-900)",
                        }}
                      >
                        {param.label}
                        {param.type === "color" && (
                          <span
                            className="inline-block w-3 h-3 ml-1.5 rounded-sm align-middle border border-[var(--color-neutral-700)]"
                            style={{ backgroundColor: String(param.defaultValue) }}
                            aria-hidden="true"
                          />
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              {isActive && (
                <div className="flex flex-wrap items-center gap-4">
                  <Link
                    href={`/campaigns/${campaign.slug}/experience`}
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor: campaign.branding.primaryColor,
                      color: "#fff",
                    }}
                    aria-label="Start the music experience"
                  >
                    Start Experience
                    <svg
                      viewBox="0 0 16 16"
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                    >
                      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                  <ShareButton campaignSlug={campaign.slug} />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Gallery preview */}
      <section
        className="border-b"
        style={{
          borderColor: "var(--color-neutral-800)",
          backgroundColor: "var(--color-neutral-950)",
        }}
        aria-labelledby="gallery-section-title"
      >
        <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-12 md:py-16">
          <div className="flex items-baseline justify-between mb-8">
            <div>
              <p
                className="caption-label mb-2"
                style={{ color: "var(--color-neutral-400)" }}
              >
                Fan Artworks
              </p>
              <h2
                id="gallery-section-title"
                className="heading-editorial text-3xl"
                style={{ color: "var(--color-neutral-50)" }}
              >
                Gallery
              </h2>
            </div>
            <div className="text-right">
              <p
                className="font-mono text-2xl font-bold"
                style={{ color: "var(--color-neutral-50)" }}
              >
                {formatCount(campaign.artworkCount)}
              </p>
              <p
                className="caption-label text-[10px]"
                style={{ color: "var(--color-neutral-400)" }}
              >
                Total Works
              </p>
            </div>
          </div>

          {previewArtworks.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
                {previewArtworks.map((artwork, index) => (
                  <Link
                    key={artwork.id}
                    href={`/artworks/${artwork.id}`}
                    className="group block"
                    aria-label={`View artwork: ${artwork.title}`}
                  >
                    <div className="relative overflow-hidden">
                      <ArtworkPreviewPlaceholder
                        index={index}
                        accentColor={campaign.branding.primaryColor}
                      />
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="w-6 h-6"
                          fill="none"
                          stroke="white"
                          strokeWidth="1.5"
                          aria-hidden="true"
                        >
                          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                    <p
                      className="text-xs mt-1.5 truncate"
                      style={{ color: "var(--color-neutral-400)" }}
                    >
                      {artwork.title}
                    </p>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div
              className="border py-16 text-center mb-6"
              style={{ borderColor: "var(--color-neutral-800)" }}
            >
              <p style={{ color: "var(--color-neutral-400)" }}>
                No artworks yet. Be the first to create one!
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={`/campaigns/${campaign.slug}/gallery`}
              className="text-sm font-medium flex items-center gap-1.5 hover:opacity-70 transition-opacity"
              style={{ color: campaign.branding.primaryColor }}
            >
              View all artworks
              <svg
                viewBox="0 0 16 16"
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            {isActive && (
              <Link
                href={`/campaigns/${campaign.slug}/create`}
                className="text-sm"
                style={{ color: "var(--color-neutral-400)" }}
              >
                → Create your own
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Participation info + CTA bottom */}
      {isActive && (
        <section
          style={{ backgroundColor: "var(--color-neutral-950)" }}
          aria-labelledby="participate-title"
        >
          <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-16 md:py-20">
            <div className="text-center max-w-2xl mx-auto">
              <p
                className="caption-label mb-4"
                style={{ color: campaign.branding.primaryColor }}
              >
                Join {formatCount(campaign.participantCount)} participants
              </p>
              <h2
                id="participate-title"
                className="heading-editorial text-5xl mb-6"
                style={{ color: "var(--color-neutral-50)" }}
              >
                Make Your Sound Visible.
              </h2>
              <p
                className="text-base leading-relaxed mb-8"
                style={{ color: "var(--color-neutral-400)" }}
              >
                Experience the music, customize your artwork, and share it with the world.
                No login required to start.
              </p>
              <Link
                href={`/campaigns/${campaign.slug}/experience`}
                className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: campaign.branding.primaryColor,
                  color: "#fff",
                }}
              >
                Start Experience
                <svg
                  viewBox="0 0 16 16"
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Back link */}
      <div
        className="border-t"
        style={{
          borderColor: "var(--color-neutral-800)",
          backgroundColor: "var(--color-neutral-950)",
        }}
      >
        <div className="max-w-[var(--container-2xl)] mx-auto px-6 py-6 flex justify-between items-center">
          <Link
            href="/explore"
            className="text-sm hover:opacity-70 transition-opacity"
            style={{ color: "var(--color-neutral-400)" }}
          >
            ← Back to Explore
          </Link>
          <Link
            href={`/artists/${artist.slug}`}
            className="text-sm hover:opacity-70 transition-opacity"
            style={{ color: "var(--color-neutral-400)" }}
          >
            {artist.name} →
          </Link>
        </div>
      </div>
    </main>
  );
}
