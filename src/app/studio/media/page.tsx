export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getRepository } from "@/lib/repository";
import { getStudioAccess } from "@/lib/studio/session";
import { StudioForbidden } from "@/components/studio/studio-forbidden";
import { StudioPageHeader } from "@/components/studio/ui";
import { MediaManager } from "./_components/media-manager";

export const metadata: Metadata = { title: "Media" };

export default async function StudioMediaPage() {
  const access = await getStudioAccess("/studio/media");
  if (access.status !== "ok") return <StudioForbidden />;
  const { assets } = await getRepository().media.listByArtist(access.artist.id, { page: 1, pageSize: 200 });
  return (
    <>
      <StudioPageHeader eyebrow="Media" title="Media manager" description="Images, audio, video, fonts and 3D models for your scenes." />
      <MediaManager initialAssets={assets} canDelete={access.can("media.delete")} />
    </>
  );
}
