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
  const saved = await getRepository().stage.get(access.artist.id);

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
      />
    </>
  );
}
