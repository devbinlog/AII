import type { Campaign, Artist, Experience } from "@/types";
import { Badge } from "@/components/ui/badge";
import { formatCount, formatDate } from "@/lib/utils/format";

interface CampaignHeroProps {
  campaign: Campaign;
  artist: Artist;
  experience: Experience;
}

function HeroBg({ primaryColor }: { primaryColor: string }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      aria-hidden="true"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      <svg
        viewBox="0 0 1440 600"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="1440" height="600" fill="#0a0a0a" />
        {Array.from({ length: 20 }).map((_, i) => (
          <line
            key={i}
            x1={i * 72}
            y1="0"
            x2={i * 72}
            y2="600"
            stroke={primaryColor}
            strokeWidth="0.5"
            opacity={0.05}
          />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <line
            key={`h${i}`}
            x1="0"
            y1={i * 100}
            x2="1440"
            y2={i * 100}
            stroke={primaryColor}
            strokeWidth="0.5"
            opacity={0.04}
          />
        ))}
        <circle cx="1200" cy="300" r="400" fill="none" stroke={primaryColor} strokeWidth="0.5" opacity="0.12" />
        <circle cx="1200" cy="300" r="250" fill="none" stroke={primaryColor} strokeWidth="0.5" opacity="0.08" />
        <circle cx="1200" cy="300" r="120" fill={primaryColor} opacity="0.04" />
      </svg>
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to right, #0a0a0a 35%, transparent 100%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 50% 80% at 80% 50%, ${primaryColor}18 0%, transparent 70%)`,
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-24"
        style={{
          background: "linear-gradient(to top, #0a0a0a, transparent)",
        }}
      />
    </div>
  );
}

export function CampaignHero({ campaign, artist: _artist, experience }: CampaignHeroProps) {
  const accentColor = campaign.branding.primaryColor;
  const isActive = campaign.status === "active";
  const isScheduled = campaign.status === "scheduled";

  return (
    <section
      className="relative min-h-[55vh] flex items-end overflow-hidden"
      aria-labelledby="campaign-title"
    >
      <HeroBg primaryColor={accentColor} />

      <div className="relative z-10 w-full max-w-[var(--container-2xl)] mx-auto px-6 py-14 md:py-20">
        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <Badge
            variant={isActive ? "accent" : isScheduled ? "warning" : "secondary"}
          >
            {campaign.status}
          </Badge>

          {isActive && (
            <span
              className="flex items-center gap-1.5 text-xs font-semibold"
              style={{ color: "#4ade80" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: "#4ade80" }}
              />
              LIVE
            </span>
          )}

          {experience.editableParameters.length > 0 && (
            <span
              className="text-xs px-2 py-0.5 border font-mono"
              style={{
                borderColor: `${accentColor}40`,
                color: `${accentColor}99`,
              }}
            >
              {experience.editableParameters.length} editable params
            </span>
          )}
        </div>

        {/* Campaign title */}
        <h1
          id="campaign-title"
          className="heading-display"
          style={{
            fontSize: "clamp(3rem,9vw,9rem)",
            color: "#f5f5f0",
            lineHeight: 0.9,
            maxWidth: "14ch",
          }}
        >
          {campaign.title}
        </h1>

        {/* Tagline */}
        {campaign.branding.tagline && (
          <p
            className="mt-5 text-lg italic"
            style={{ color: accentColor }}
          >
            &ldquo;{campaign.branding.tagline}&rdquo;
          </p>
        )}

        {/* Stats row */}
        <div className="mt-8 flex items-center gap-8 flex-wrap">
          <div>
            <p
              className="font-mono text-2xl font-bold"
              style={{ color: "#f5f5f0" }}
            >
              {formatCount(campaign.participantCount)}
            </p>
            <p
              className="caption-label mt-0.5"
              style={{ color: "rgba(245,245,240,0.4)" }}
            >
              Participants
            </p>
          </div>
          <div>
            <p
              className="font-mono text-2xl font-bold"
              style={{ color: "#f5f5f0" }}
            >
              {formatCount(campaign.artworkCount)}
            </p>
            <p
              className="caption-label mt-0.5"
              style={{ color: "rgba(245,245,240,0.4)" }}
            >
              Artworks
            </p>
          </div>
          {campaign.endsAt && isActive && (
            <div>
              <p
                className="font-mono text-2xl font-bold"
                style={{ color: "#f5f5f0" }}
              >
                {formatDate(campaign.endsAt, { month: "short", day: "numeric" })}
              </p>
              <p
                className="caption-label mt-0.5"
                style={{ color: "rgba(245,245,240,0.4)" }}
              >
                Ends
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
