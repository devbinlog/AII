export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository } from "@/lib/repository";
import { getStudioAccess } from "@/lib/studio/session";
import { ownsResource } from "@/lib/studio/policy";
import { loadExperienceReadiness } from "@/lib/studio/readiness-loader";
import { StudioForbidden } from "@/components/studio/studio-forbidden";
import { HydrationGate } from "@/components/ui/hydration-gate";
import { StatusBadge } from "@/components/studio/ui";
import { ExperiencePreview, type PreviewScene } from "./_components/experience-preview";

export const metadata: Metadata = { title: "Preview" };

/**
 * Owner-only preview of the SAVED draft — exactly what the next publish would
 * freeze. Never reachable by fans: Studio access + ownership are checked here,
 * and the Studio layout is noindex.
 */
export default async function StudioExperiencePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await getStudioAccess(`/studio/experiences/${id}/preview`);
  if (access.status !== "ok") return <StudioForbidden />;
  const repo = getRepository();
  const experience = await repo.experience.findById(id);
  if (!experience || !ownsResource(access.artist.id, experience)) notFound();

  const ordered = [...experience.scenes].sort((a, b) => a.order - b.order);
  const scenes: PreviewScene[] = [];
  for (const entry of ordered) {
    const scene = await repo.scene.findById(entry.sceneId);
    // Only the artist's own scenes are ever rendered; anything else is reported as missing.
    if (scene && ownsResource(access.artist.id, scene)) {
      scenes.push({ id: scene.id, name: scene.name, schema: scene.schema, transitionType: entry.transitionType, transitionDuration: entry.transitionDuration });
    }
  }
  // Missing or foreign scenes surface as readiness issues (SCENE_NOT_FOUND / SCENE_FOREIGN).
  const readiness = await loadExperienceReadiness(repo, experience);
  const sceneNames = new Map(scenes.map((s) => [s.id, s.name]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/studio/experiences/${experience.id}`} className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
          ← Back to editor
        </Link>
        <h1 className="flex-1 min-w-0 truncate text-2xl font-semibold">{experience.title}</h1>
        <StatusBadge status="preview" />
      </div>

      <p className="border border-amber-500/40 px-3 py-2 text-sm text-amber-300">
        Draft preview — fans do not see this.
        {readiness.liveVersion ? ` They still play live v${readiness.liveVersion.version}.` : " Nothing is published yet."}
        {" "}Only saved edits appear here.
      </p>

      {scenes.length === 0 ? (
        <div className="border border-dashed border-[var(--color-border-strong)] px-6 py-10 text-center text-sm">
          <p className="font-medium">No scenes to preview</p>
          <p className="mt-2 text-[var(--color-fg-muted)]">
            Add scenes to the sequence in the <Link href={`/studio/experiences/${experience.id}`} className="underline">editor</Link> and save.
          </p>
        </div>
      ) : (
        <HydrationGate>
          <ExperiencePreview scenes={scenes} />
        </HydrationGate>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="preview-params" className="border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          <h2 id="preview-params" className="text-xs font-mono font-semibold uppercase tracking-widest text-[var(--color-fg-muted)]">
            Fans can customize ({experience.editableParameters.length})
          </h2>
          {experience.editableParameters.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-fg-muted)]">Nothing — the Fan Creator will have no controls.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {experience.editableParameters.map((p) => (
                <li key={p.id} className="flex justify-between gap-3">
                  <span className="truncate">{p.label}</span>
                  <span className="shrink-0 text-xs text-[var(--color-fg-muted)]">{sceneNames.get(p.sceneId) ?? "Missing scene"} · {p.type}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="preview-ready" className="border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          <h2 id="preview-ready" className="text-xs font-mono font-semibold uppercase tracking-widest text-[var(--color-fg-muted)]">Publish readiness</h2>
          <p className={`mt-3 text-sm ${readiness.ready ? "text-emerald-400" : "text-[var(--color-accent-fg)]"}`}>
            {readiness.ready ? `Ready to publish as v${readiness.nextVersion}` : "Not ready to publish"}
          </p>
          {readiness.issues.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-xs text-[var(--color-fg-muted)]">
              {readiness.issues.map((issue, i) => <li key={`${issue.code}-${i}`}>{issue.message}</li>)}
            </ul>
          )}
          <Link href={`/studio/experiences/${experience.id}`} className="mt-3 inline-block text-sm underline underline-offset-4">
            {access.can("experience.publish") ? "Back to editor to publish" : "Back to editor"}
          </Link>
        </section>
      </div>
    </div>
  );
}
