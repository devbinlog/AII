export const dynamic = "force-dynamic";

import { HydrationGate } from "@/components/ui/hydration-gate";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository } from "@/lib/repository";
import { getStudioAccess } from "@/lib/studio/session";
import { ownsResource } from "@/lib/studio/policy";
import { StudioForbidden } from "@/components/studio/studio-forbidden";
import { Panel, StatusBadge, StudioPageHeader } from "@/components/studio/ui";
import { ReleaseEditor } from "./_components/release-editor";

export const metadata: Metadata = { title: "Release" };

export default async function StudioReleasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await getStudioAccess(`/studio/releases/${id}`);
  if (access.status !== "ok") return <StudioForbidden />;
  const repo = getRepository();
  const release = await repo.release.findById(id);
  if (!release || !ownsResource(access.artist.id, release)) notFound();
  const { experiences } = await repo.experience.listByArtist(access.artist.id, { page: 1, pageSize: 200 });
  const linked = experiences.filter((e) => e.releaseId === release.id);

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
      <HydrationGate>
        <ReleaseEditor release={release} canPublish={access.can("release.publish")} />
      </HydrationGate>
      <Panel
        title={`Experiences for this release (${linked.length})`}
        className="mt-6"
        actions={
          <Link href={`/studio/experiences?release=${release.id}`} className="text-xs underline underline-offset-4">
            New experience
          </Link>
        }
      >
        {linked.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">
            No experience uses this release yet. Next step: turn it into an interactive experience fans can play.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {linked.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3">
                <Link href={`/studio/experiences/${e.id}`} className="min-w-0 truncate hover:underline underline-offset-4">{e.title}</Link>
                <StatusBadge status={e.currentVersionId ? "published" : "draft"} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
