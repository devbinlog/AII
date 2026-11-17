export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository } from "@/lib/repository";
import { StageViewer } from "@/components/stage/stage-viewer";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function load(slug: string) {
  const repo = getRepository();
  const artist = await repo.artist.findBySlug(slug);
  // Fans only ever read the published version — never the draft.
  const stage = artist ? await repo.stage.getPublished(artist.id) : null;
  return artist && stage ? { artist, stage } : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await load((await params).slug);
  if (!data) return { title: "Stage Not Found" };
  return { title: `${data.artist.name} — Live Stage`, description: `Explore ${data.artist.name}'s 3D stage.` };
}

export default async function PublicStagePage({ params }: PageProps) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { artist, stage } = data;

  return (
    <main className="studio flex-1 bg-[var(--color-bg)] text-[var(--color-fg)]">
      <div className="max-w-[var(--container-2xl)] mx-auto px-4 md:px-6 py-8 md:py-12">
        <Link href={`/artists/${artist.slug}`} className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
          ← {artist.name}
        </Link>
        <header className="mt-4 mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="caption-label" style={{ color: "#2f8fff" }}>Live Stage</p>
            <h1 className="heading-display mt-2" style={{ fontSize: "clamp(2.25rem,6vw,4.5rem)", lineHeight: 0.95 }}>
              {artist.name}
            </h1>
          </div>
          <p className="text-xs font-mono text-[var(--color-fg-muted)]">
            Stage v{stage.version} · {new Date(stage.publishedAt).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" })}
          </p>
        </header>
        <StageViewer items={stage.items} artistName={artist.name} />
      </div>
    </main>
  );
}
