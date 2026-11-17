export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getRepository } from "@/lib/repository";
import { getStudioAccess } from "@/lib/studio/session";
import { StudioForbidden } from "@/components/studio/studio-forbidden";
import { EmptyState, Panel, RowLink, StatusBadge, StudioPageHeader } from "@/components/studio/ui";
import { formatDate } from "@/lib/utils/format";
import { CreateReleaseForm } from "./_components/create-release-form";

export const metadata: Metadata = { title: "Releases" };

export default async function StudioReleasesPage() {
  const access = await getStudioAccess("/studio/releases");
  if (access.status !== "ok") return <StudioForbidden />;
  const { releases } = await getRepository().release.listByArtist(access.artist.id, { page: 1, pageSize: 200 });

  return (
    <>
      <StudioPageHeader eyebrow="Releases" title="Release manager" description="Draft releases stay private until an admin publishes them." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Panel title={`${releases.length} releases`}>
          {releases.length === 0 ? (
            <EmptyState title="No releases yet" />
          ) : (
            <div className="-m-4">
              {releases.map((r) => (
                <RowLink key={r.id} href={`/studio/releases/${r.id}`}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{r.title}</span>
                    <span className="block text-xs text-[var(--color-fg-muted)] uppercase font-mono">
                      {r.type} · {r.tracks.length} tracks · {formatDate(r.releaseDate)}
                    </span>
                  </span>
                  <StatusBadge status={r.status} />
                </RowLink>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="New release">
          <CreateReleaseForm />
        </Panel>
      </div>
    </>
  );
}
