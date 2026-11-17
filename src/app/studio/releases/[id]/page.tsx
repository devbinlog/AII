export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository } from "@/lib/repository";
import { getStudioAccess } from "@/lib/studio/session";
import { ownsResource } from "@/lib/studio/policy";
import { StudioForbidden } from "@/components/studio/studio-forbidden";
import { StatusBadge, StudioPageHeader } from "@/components/studio/ui";
import { ReleaseEditor } from "./_components/release-editor";

export const metadata: Metadata = { title: "Release" };

export default async function StudioReleasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await getStudioAccess(`/studio/releases/${id}`);
  if (access.status !== "ok") return <StudioForbidden />;
  const release = await getRepository().release.findById(id);
  if (!release || !ownsResource(access.artist.id, release)) notFound();

  return (
    <>
      <Link href="/studio/releases" className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">← Releases</Link>
      <StudioPageHeader
        eyebrow="Release"
        title={release.title}
        actions={
          <>
            <StatusBadge status={release.status} />
            {release.status !== "draft" && (
              <Link href={`/releases/${release.id}`} className="text-sm underline underline-offset-4">Public page</Link>
            )}
          </>
        }
      />
      <ReleaseEditor release={release} canPublish={access.can("release.publish")} />
    </>
  );
}
