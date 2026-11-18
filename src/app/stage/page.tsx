// Stage index: every artist with a *published* stage. Drafts are never listed.
export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import { getRepository } from "@/lib/repository";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Live Stages",
  description: "Step onto published 3D stages from AII artists.",
};

export default async function StageIndexPage() {
  const repo = getRepository();
  const { artists } = await repo.artist.list({ page: 1, pageSize: 100 });
  const stages = (
    await Promise.all(artists.map(async (artist) => ({ artist, stage: await repo.stage.getPublished(artist.id) })))
  ).flatMap(({ artist, stage }) => (stage ? [{ artist, stage }] : []));

  return (
    <main className="studio stage-theme flex-1 bg-[var(--stage-void)] text-[var(--aii-paper)]">
      <div className="max-w-[var(--container-2xl)] mx-auto px-4 md:px-6 py-12 md:py-16">
        <p className="caption-label" style={{ color: "var(--stage-cyan)" }}>Live Stage</p>
        <h1 className="heading-display mt-3 text-[clamp(2.75rem,7vw,6rem)] leading-[0.92]">Step onto the stage</h1>
        <p className="mt-4 max-w-md text-sm text-[var(--aii-stone)]">
          Published 3D stages from AII artists. Orbit, zoom and inspect each band&apos;s setup.
        </p>

        {stages.length === 0 ? (
          <div className="mt-12 border border-dashed border-[#26496c] p-10 text-center" role="status">
            <p className="text-lg font-semibold">No stage is open right now.</p>
            <p className="mt-2 text-sm text-[var(--aii-stone)]">Artists publish their stage from Artist Studio. Check back soon.</p>
          </div>
        ) : (
          <ul className="mt-12 grid gap-4 md:grid-cols-2">
            {stages.map(({ artist, stage }) => (
              <li key={artist.id}>
                <Link
                  href={`/artists/${artist.slug}/stage`}
                  className="group block border border-[#26496c] bg-[var(--stage-void-2)] p-6 transition-colors hover:border-[var(--stage-cyan)] focus-visible:outline-2 focus-visible:outline-[var(--stage-cyan)]"
                >
                  <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--stage-cyan)]">
                    Stage v{stage.version} · {formatDate(stage.publishedAt)}
                  </p>
                  <p className="heading-display mt-3 text-4xl md:text-5xl">{artist.name}</p>
                  <p className="mt-6 text-sm font-semibold text-[var(--aii-paper)] group-hover:text-[var(--stage-cyan)]">
                    Enter the 3D stage <span aria-hidden="true">→</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
