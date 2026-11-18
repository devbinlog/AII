export const dynamic = "force-dynamic";

import { HydrationGate } from "@/components/ui/hydration-gate";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository } from "@/lib/repository";
import { getStudioAccess } from "@/lib/studio/session";
import { ownsResource } from "@/lib/studio/policy";
import { StudioForbidden } from "@/components/studio/studio-forbidden";
import { CampaignEditor } from "./_components/campaign-editor";

export const metadata: Metadata = { title: "Campaign" };

export default async function StudioCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await getStudioAccess(`/studio/campaigns/${id}`);
  if (access.status !== "ok") return <StudioForbidden />;
  const repo = getRepository();
  const campaign = await repo.campaign.findById(id);
  if (!campaign || !ownsResource(access.artist.id, campaign)) notFound();
  const { experiences } = await repo.experience.listByArtist(access.artist.id, { page: 1, pageSize: 200 });

  return (
    <HydrationGate>
      <CampaignEditor
        campaign={campaign}
        experiences={experiences.map((e) => ({ id: e.id, title: e.title, published: e.currentVersionId !== null }))}
        canPublish={access.can("campaign.publish")}
      />
    </HydrationGate>
  );
}
