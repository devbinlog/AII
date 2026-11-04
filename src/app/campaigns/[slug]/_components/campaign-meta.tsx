import type { Campaign, Artist, Experience } from "@/types";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/format";

interface CampaignMetaProps {
  campaign: Campaign;
  artist: Artist;
  experience: Experience;
}

export function CampaignMeta({ campaign, artist, experience }: CampaignMetaProps) {
  const accentColor = campaign.branding.primaryColor;

  return (
    <section
      className="border-b"
      style={{ borderColor: "var(--color-neutral-800)" }}
      aria-label="Campaign details"
    >
      <div
        className="max-w-[var(--container-2xl)] mx-auto px-6 py-12 md:py-16"
        style={{ backgroundColor: "var(--color-neutral-950)" }}
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Left label */}
          <div className="md:col-span-3">
            <p
              className="caption-label"
              style={{ color: "var(--color-neutral-400)" }}
            >
              About Campaign
            </p>
          </div>

          {/* Center content */}
          <div className="md:col-span-6 space-y-6">
            {/* Description */}
            <p
              className="text-base leading-relaxed"
              style={{ color: "var(--color-neutral-50)" }}
            >
              {campaign.description}
            </p>

            {/* Participation policy */}
            <div className="space-y-2">
              <p
                className="caption-label text-[10px]"
                style={{ color: "var(--color-neutral-400)" }}
              >
                Participation
              </p>
              <div className="flex flex-wrap gap-2">
                {campaign.participationPolicy.allowAnonymousCreate && (
                  <Badge variant="outline">No Login Required</Badge>
                )}
                {campaign.participationPolicy.maxArtworksPerUser > 0 && (
                  <Badge variant="outline">
                    Max {campaign.participationPolicy.maxArtworksPerUser} per user
                  </Badge>
                )}
                {campaign.participationPolicy.moderationEnabled && (
                  <Badge variant="outline">Moderated</Badge>
                )}
              </div>
            </div>

            {/* Dates */}
            {(campaign.startsAt || campaign.endsAt) && (
              <div className="flex gap-8 text-sm">
                {campaign.startsAt && (
                  <div>
                    <p
                      className="caption-label text-[10px] mb-1"
                      style={{ color: "var(--color-neutral-400)" }}
                    >
                      Started
                    </p>
                    <p style={{ color: "var(--color-neutral-50)" }}>
                      {formatDate(campaign.startsAt)}
                    </p>
                  </div>
                )}
                {campaign.endsAt && (
                  <div>
                    <p
                      className="caption-label text-[10px] mb-1"
                      style={{ color: "var(--color-neutral-400)" }}
                    >
                      Ends
                    </p>
                    <p style={{ color: "var(--color-neutral-50)" }}>
                      {formatDate(campaign.endsAt)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Artist info */}
          <div className="md:col-span-3">
            <p
              className="caption-label text-[10px] mb-4"
              style={{ color: "var(--color-neutral-400)" }}
            >
              Artist
            </p>
            <Link
              href={`/artists/${artist.slug}`}
              className="group block"
            >
              <div
                className="border p-4 transition-colors"
                style={{
                  borderColor: "var(--color-neutral-800)",
                  backgroundColor: "var(--color-neutral-900)",
                }}
              >
                {artist.isVerified && (
                  <span
                    className="flex items-center gap-1 text-[10px] font-semibold mb-2 w-fit px-1.5 py-0.5"
                    style={{
                      backgroundColor: accentColor,
                      color: "#fff",
                    }}
                  >
                    <svg
                      viewBox="0 0 12 12"
                      className="w-2.5 h-2.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M2 6l3 3 5-5" />
                    </svg>
                    Verified
                  </span>
                )}
                <h3
                  className="font-semibold text-sm mb-2 group-hover:opacity-70 transition-opacity"
                  style={{ color: "var(--color-neutral-50)" }}
                >
                  {artist.name}
                </h3>
                <p
                  className="text-xs leading-relaxed line-clamp-3"
                  style={{ color: "var(--color-neutral-400)" }}
                >
                  {artist.bio}
                </p>
                <p
                  className="mt-3 text-xs flex items-center gap-1"
                  style={{ color: accentColor }}
                >
                  View profile
                  <svg
                    viewBox="0 0 12 12"
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <path d="M1 11 11 1M11 1H4M11 1v7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </p>
              </div>
            </Link>

            {/* Experience info */}
            <div
              className="mt-4 border p-4"
              style={{
                borderColor: "var(--color-neutral-800)",
                backgroundColor: "var(--color-neutral-900)",
              }}
            >
              <p
                className="caption-label text-[10px] mb-2"
                style={{ color: "var(--color-neutral-400)" }}
              >
                Experience
              </p>
              <p
                className="text-sm font-medium mb-1"
                style={{ color: "var(--color-neutral-50)" }}
              >
                {experience.title}
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--color-neutral-400)" }}
              >
                {experience.scenes.length} scene{experience.scenes.length !== 1 ? "s" : ""} ·{" "}
                {experience.editableParameters.length} customizable param{experience.editableParameters.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
