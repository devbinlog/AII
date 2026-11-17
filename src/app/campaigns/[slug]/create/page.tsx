export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getRepository } from "@/lib/repository";
import { isPublicCampaign } from "@/lib/public-visibility";
import { getSession } from "@/lib/auth/session";
import { FanCreatorClient } from "./_components/fan-creator-client";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const repo = getRepository();
  const campaign = await repo.campaign.findBySlug(slug);
  return {
    title: campaign && isPublicCampaign(campaign) ? `Create — ${campaign.title}` : "Create Artwork",
  };
}

export default async function CreatePage({ params }: PageProps) {
  const { slug } = await params;
  const repo = getRepository();

  // Load campaign
  const campaign = await repo.campaign.findBySlug(slug);
  if (!campaign || !isPublicCampaign(campaign)) return notFound();

  // Check campaign is active
  if (campaign.status !== "active") {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center"
        style={{
          backgroundColor: "var(--color-neutral-950)",
          color: "var(--color-neutral-50)",
        }}
      >
        <span
          className="font-mono text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded mb-6"
          style={{
            backgroundColor: "rgba(232,25,44,0.1)",
            color: "var(--color-accent)",
            border: "1px solid rgba(232,25,44,0.25)",
          }}
        >
          {campaign.status}
        </span>
        <h1
          className="text-4xl font-bold mb-3"
          style={{ color: "var(--color-neutral-50)" }}
        >
          Campaign Not Active
        </h1>
        <p
          className="text-base max-w-sm"
          style={{ color: "var(--color-neutral-400)" }}
        >
          &ldquo;{campaign.title}&rdquo; is not currently accepting new artworks.
          Check back later or explore other campaigns.
        </p>
      </div>
    );
  }

  // Load experience
  const experience = await repo.experience.findById(campaign.experienceId);
  if (!experience) return notFound();

  if (!experience.currentVersionId) return notFound();

  // Load experience version
  const experienceVersion = await repo.experience.findVersionById(
    experience.currentVersionId
  );
  if (!experienceVersion) return notFound();

  // Check session (for logged-in state)
  const session = await getSession();
  const isLoggedIn = session !== null;

  return (
    <FanCreatorClient
      campaign={campaign}
      experience={experience}
      experienceVersion={experienceVersion}
      editableParameters={experience.editableParameters}
      isLoggedIn={isLoggedIn}
      campaignSlug={slug}
    />
  );
}
