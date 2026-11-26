export const dynamic = "force-dynamic";

import { HydrationGate } from "@/components/ui/hydration-gate";
import type { Metadata } from "next";
import { getRepository } from "@/lib/repository";
import { getStudioAccess } from "@/lib/studio/session";
import { StudioForbidden } from "@/components/studio/studio-forbidden";
import { EmptyState, Panel, RowLink, StatusBadge, StudioPageHeader } from "@/components/studio/ui";
import { formatCount } from "@/lib/utils/format";
import { CreateCampaignForm } from "./_components/create-campaign-form";

export const metadata: Metadata = { title: "Campaigns" };

export default async function StudioCampaignsPage({ searchParams }: { searchParams: Promise<{ experience?: string }> }) {
  const requestedExperience = (await searchParams).experience;
  const access = await getStudioAccess("/studio/campaigns");
  if (access.status !== "ok") return <StudioForbidden />;
  const repo = getRepository();
  const [{ campaigns }, { experiences }] = await Promise.all([
    repo.campaign.listByArtist(access.artist.id, { page: 1, pageSize: 200 }),
    repo.experience.listByArtist(access.artist.id, { page: 1, pageSize: 200 }),
  ]);

  return (
    <>
      <StudioPageHeader eyebrow="Campaigns" title="Campaign builder" description="A campaign is the public page where fans play your experience and create artworks." />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Panel title={`${campaigns.length} campaigns`}>
          {campaigns.length === 0 ? (
            <EmptyState title="No campaigns yet" />
          ) : (
            <div className="-m-4">
              {campaigns.map((c) => (
                <RowLink key={c.id} href={`/studio/campaigns/${c.id}`}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{c.title}</span>
                    <span className="block text-xs text-[var(--color-fg-muted)] font-mono">
                      /campaigns/{c.slug} · {formatCount(c.participantCount)} participants · {formatCount(c.artworkCount)} artworks
                    </span>
                  </span>
                  <StatusBadge status={c.status} />
                </RowLink>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="New campaign">
          {experiences.length === 0 ? (
            <p className="text-sm text-[var(--color-fg-muted)]">Create an experience first.</p>
          ) : (
            <HydrationGate>
              <CreateCampaignForm
                experiences={experiences.map((e) => ({ id: e.id, title: e.title, published: e.currentVersionId !== null }))}
                // Only one of this artist's own experiences can be preselected.
                initialExperienceId={experiences.some((e) => e.id === requestedExperience) ? requestedExperience : undefined}
              />
            </HydrationGate>
          )}
        </Panel>
      </div>
    </>
  );
}
