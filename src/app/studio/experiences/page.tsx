export const dynamic = "force-dynamic";

import { HydrationGate } from "@/components/ui/hydration-gate";
import type { Metadata } from "next";
import { getRepository } from "@/lib/repository";
import { getStudioAccess } from "@/lib/studio/session";
import { StudioForbidden } from "@/components/studio/studio-forbidden";
import { EmptyState, Panel, RowLink, StatusBadge, StudioPageHeader } from "@/components/studio/ui";
import { CreateExperienceForm } from "./_components/create-experience-form";

export const metadata: Metadata = { title: "Experiences" };

export default async function StudioExperiencesPage() {
  const access = await getStudioAccess("/studio/experiences");
  if (access.status !== "ok") return <StudioForbidden />;
  const repo = getRepository();
  const [{ experiences }, { releases }] = await Promise.all([
    repo.experience.listByArtist(access.artist.id, { page: 1, pageSize: 200 }),
    repo.release.listByArtist(access.artist.id, { page: 1, pageSize: 200 }),
  ]);
  const versionLabels = new Map<string, string>();
  for (const e of experiences) {
    if (e.currentVersionId) {
      const v = await repo.experience.findVersionById(e.currentVersionId);
      if (v) versionLabels.set(e.id, v.version);
    }
  }

  return (
    <>
      <StudioPageHeader eyebrow="Experiences" title="Experiences" description="An experience is an ordered set of scenes. Publishing freezes it into a version fans play." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Panel title={`${experiences.length} experiences`}>
          {experiences.length === 0 ? (
            <EmptyState title="No experiences yet" />
          ) : (
            <div className="-m-4">
              {experiences.map((e) => (
                <RowLink key={e.id} href={`/studio/experiences/${e.id}`}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{e.title}</span>
                    <span className="block text-xs text-[var(--color-fg-muted)]">
                      {e.scenes.length} scenes · {e.editableParameters.length} fan parameters
                      {versionLabels.get(e.id) ? ` · live v${versionLabels.get(e.id)}` : ""}
                    </span>
                  </span>
                  <StatusBadge status={e.currentVersionId ? "published" : "draft"} />
                </RowLink>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="New experience">
          <HydrationGate>
            <CreateExperienceForm releases={releases.map((r) => ({ id: r.id, title: r.title }))} />
          </HydrationGate>
        </Panel>
      </div>
    </>
  );
}
