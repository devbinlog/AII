export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository } from "@/lib/repository";
import { StageViewer } from "@/components/stage/stage-viewer";
import { getArtistTheme } from "@/lib/theme/artist-theme";
import { canEditArtistInStudio } from "@/lib/studio/session";
import { formatDate } from "@/lib/utils/format";

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
  // Artist identity only tints the header rule; the stage itself uses the AII Stage palette.
  const theme = getArtistTheme(artist);
  const canEdit = await canEditArtistInStudio(artist.id);

  return (
    <main className="studio stage-theme flex-1 bg-[var(--color-bg)] text-[var(--color-fg)]">
      <div className="max-w-[var(--container-2xl)] mx-auto px-4 md:px-6 py-8 md:py-12">
        <Link href={`/artists/${artist.slug}`} className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
          ← {artist.name}
        </Link>
        <header
          className="mt-4 mb-6 flex flex-col gap-2 border-b pb-5 md:flex-row md:items-end md:justify-between"
          style={{ ...theme.cssVars, borderColor: "var(--artist-primary)" }}
        >
          <div>
            <p className="caption-label" style={{ color: "var(--stage-cyan)" }}>Live Stage</p>
            <h1 className="heading-display mt-2" style={{ fontSize: "clamp(2.25rem,6vw,4.5rem)", lineHeight: 0.95 }}>
              {artist.name}
            </h1>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <p className="text-xs font-mono text-[var(--color-fg-muted)]">
              Stage v{stage.version} · {formatDate(stage.publishedAt)}
            </p>
            {canEdit && (
              <Link
                href="/studio/stage"
                className="inline-flex h-9 items-center self-start px-3 text-sm font-semibold border border-[var(--stage-cyan)] text-[var(--stage-cyan)] hover:bg-[var(--stage-cyan)] hover:text-[var(--stage-void)] transition-colors md:self-end"
              >
                Edit in Studio →
              </Link>
            )}
          </div>
        </header>
        <StageViewer items={stage.items} artistName={artist.name} />
      </div>
    </main>
  );
}
