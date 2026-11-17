// What public (fan-facing) pages may show. Drafts created in Artist Studio
// stay private until the artist publishes them.

import type { Campaign, Experience, Release } from "@/types";

export function isPublicRelease(release: Release): boolean {
  return release.status !== "draft";
}

export function isPublicCampaign(campaign: Campaign): boolean {
  return campaign.status !== "draft";
}

/** A published experience version exists for fans to play. */
export function isPublicExperience(experience: Experience): boolean {
  return experience.currentVersionId !== null && experience.status !== "draft";
}
