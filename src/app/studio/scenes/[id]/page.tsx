export const dynamic = "force-dynamic";

import { HydrationGate } from "@/components/ui/hydration-gate";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository } from "@/lib/repository";
import { getStudioAccess } from "@/lib/studio/session";
import { ownsResource } from "@/lib/studio/policy";
import { StudioForbidden } from "@/components/studio/studio-forbidden";
import { SceneEditor } from "./_components/scene-editor";

export const metadata: Metadata = { title: "Scene editor" };

export default async function StudioScenePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await getStudioAccess(`/studio/scenes/${id}`);
  if (access.status !== "ok") return <StudioForbidden />;
  const repo = getRepository();
  const scene = await repo.scene.findById(id);
  if (!scene || !ownsResource(access.artist.id, scene)) notFound();
  const { assets } = await repo.media.listByArtist(access.artist.id, { page: 1, pageSize: 200, type: "image" });

  return (
    <HydrationGate>
      <SceneEditor
        scene={scene}
        images={assets.map((a) => ({ id: a.id, filename: a.filename }))}
        accent={access.artist.branding.primaryColor}
      />
    </HydrationGate>
  );
}
