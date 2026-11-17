export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository } from "@/lib/repository";
import { isPublicCampaign } from "@/lib/public-visibility";
import { ExperienceClient } from "./_components/experience-client";
import type { ExperienceVersion } from "@/types/domain";

// ============================================================
// Types
// ============================================================

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ============================================================
// Metadata
// ============================================================

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const repo = getRepository();
  const campaign = await repo.campaign.findBySlug(slug);
  if (!campaign || !isPublicCampaign(campaign)) return { title: "Experience Not Found" };
  return {
    title: `${campaign.title} — Experience`,
    description: campaign.description,
  };
}

// ============================================================
// Page
// ============================================================

export default async function CampaignExperiencePage({ params }: PageProps) {
  const { slug } = await params;
  const repo = getRepository();

  // 1. Load campaign by slug
  const campaign = await repo.campaign.findBySlug(slug);
  if (!campaign || !isPublicCampaign(campaign)) notFound();

  // 2. Load experience
  const experience = await repo.experience.findById(campaign.experienceId);
  if (!experience) notFound();

  // 3. Load current version
  const versionId = experience.currentVersionId;
  if (!versionId) notFound();

  const experienceVersion: ExperienceVersion | null =
    await repo.experience.findVersionById(versionId);
  if (!experienceVersion) notFound();

  // 4. Validate that there is at least one scene
  if (experienceVersion.snapshot.scenes.length === 0) notFound();

  return (
    <>
      {/* Demo Mode server-rendered badge (visible before client hydrates) */}
      <div
        className="sr-only"
        aria-label="This page is running in Demo Mode with simulated audio"
      />
      <ExperienceClient
        slug={slug}
        experienceTitle={experience.title}
        experienceVersion={experienceVersion}
      />
    </>
  );
}
