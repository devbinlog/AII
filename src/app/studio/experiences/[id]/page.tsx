export const dynamic = "force-dynamic";

import { HydrationGate } from "@/components/ui/hydration-gate";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository } from "@/lib/repository";
import { getStudioAccess } from "@/lib/studio/session";
import { ownsResource } from "@/lib/studio/policy";
import { StudioForbidden } from "@/components/studio/studio-forbidden";
import { ExperienceEditor } from "./_components/experience-editor";

export const metadata: Metadata = { title: "Experience" };

export default async function StudioExperiencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await getStudioAccess(`/studio/experiences/${id}`);
  if (access.status !== "ok") return <StudioForbidden />;
  const repo = getRepository();
  const experience = await repo.experience.findById(id);
  if (!experience || !ownsResource(access.artist.id, experience)) notFound();

  const [{ scenes }, { releases }, { campaigns }, versions] = await Promise.all([
    repo.scene.listByArtist(access.artist.id, { page: 1, pageSize: 200 }),
    repo.release.listByArtist(access.artist.id, { page: 1, pageSize: 200 }),
    repo.campaign.listByArtist(access.artist.id, { page: 1, pageSize: 200 }),
    repo.experience.listVersions(id),
  ]);

  return (
    <HydrationGate>
      <ExperienceEditor
        experience={experience}
        scenes={scenes.map((s) => ({
          id: s.id,
          name: s.name,
          objects: s.schema.objects.map((o) => ({ id: o.id, name: o.name, type: o.data.type })),
        }))}
        releases={releases.map((r) => ({ id: r.id, title: r.title }))}
        campaigns={campaigns.filter((c) => c.experienceId === id).map((c) => ({ id: c.id, title: c.title, slug: c.slug, status: c.status }))}
        versions={versions.map((v) => ({ id: v.id, version: v.version, publishedAt: v.publishedAt, sceneCount: v.snapshot.scenes.length }))}
        canPublish={access.can("experience.publish")}
      />
    </HydrationGate>
  );
}
