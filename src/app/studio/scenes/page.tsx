export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getRepository } from "@/lib/repository";
import { getStudioAccess } from "@/lib/studio/session";
import { StudioForbidden } from "@/components/studio/studio-forbidden";
import { EmptyState, Panel, RowLink, StudioPageHeader } from "@/components/studio/ui";
import { formatRelativeTime } from "@/lib/utils/format";
import { CreateSceneForm } from "./_components/create-scene-form";

export const metadata: Metadata = { title: "Scenes" };

export default async function StudioScenesPage() {
  const access = await getStudioAccess("/studio/scenes");
  if (access.status !== "ok") return <StudioForbidden />;
  const repo = getRepository();
  const [{ scenes }, { experiences }] = await Promise.all([
    repo.scene.listByArtist(access.artist.id, { page: 1, pageSize: 200 }),
    repo.experience.listByArtist(access.artist.id, { page: 1, pageSize: 200 }),
  ]);
  const usage = new Map<string, number>();
  for (const e of experiences) for (const s of e.scenes) usage.set(s.sceneId, (usage.get(s.sceneId) ?? 0) + 1);

  return (
    <>
      <StudioPageHeader eyebrow="Scenes" title="Scene library" description="Scenes are audio-reactive canvases. Combine them into an experience to publish." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Panel title={`${scenes.length} scenes`}>
          {scenes.length === 0 ? (
            <EmptyState title="No scenes yet">Create your first scene to start designing.</EmptyState>
          ) : (
            <div className="-m-4">
              {scenes.map((s) => (
                <RowLink key={s.id} href={`/studio/scenes/${s.id}`}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{s.name}</span>
                    <span className="block text-xs text-[var(--color-fg-muted)]">
                      {s.schema.objects.length} objects · {s.schema.interactions.length} interactions · edited {formatRelativeTime(s.updatedAt)}
                    </span>
                  </span>
                  <span className="text-xs text-[var(--color-fg-muted)] font-mono">
                    {usage.get(s.id) ? `in ${usage.get(s.id)} experience${usage.get(s.id)! > 1 ? "s" : ""}` : "unused"}
                  </span>
                </RowLink>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="New scene">
          <CreateSceneForm />
        </Panel>
      </div>
    </>
  );
}
