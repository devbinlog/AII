export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getRepository } from "@/lib/repository";
import { getStudioAccess } from "@/lib/studio/session";
import { StudioForbidden } from "@/components/studio/studio-forbidden";
import { StudioPageHeader } from "@/components/studio/ui";
import { StageConfigurator } from "@/components/stage/stage-configurator";
import { defaultStageLayout } from "@/lib/stage";

export const metadata: Metadata = { title: "Stage 3D" };

export default async function StudioStagePage() {
  const access = await getStudioAccess("/studio/stage");
  if (access.status !== "ok") return <StudioForbidden />;
  const repo = getRepository();
  const [saved, published, versions] = await Promise.all([
    repo.stage.get(access.artist.id),
    repo.stage.getPublished(access.artist.id),
    repo.stage.listVersions(access.artist.id),
  ]);

  return (
    <>
      <StudioPageHeader
        eyebrow="Stage 3D"
        title="Stage configurator"
        description="Arrange hologram members and instruments on stage. Amplifiers and drums are fixed to the backline."
      />
      <StageConfigurator
        initialLayout={saved ?? defaultStageLayout(access.artist.id)}
        savedAt={saved?.updatedAt ?? null}
        canEdit={access.can("content.edit")}
        publish={{
          artistSlug: access.artist.slug,
          canPublish: access.can("stage.publish"),
          publishedVersion: published ? { id: published.id, version: published.version, publishedAt: published.publishedAt } : null,
          versionCount: versions.length,
        }}
      />
    </>
  );
}
