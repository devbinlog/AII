export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import { getRepository } from "@/lib/repository";
import { getStudioAccess } from "@/lib/studio/session";
import { StudioForbidden } from "@/components/studio/studio-forbidden";
import { Panel, RowLink, StatusBadge, StudioPageHeader, EmptyState } from "@/components/studio/ui";
import { formatCount, formatDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function StudioDashboardPage() {
  const access = await getStudioAccess("/studio");
  if (access.status !== "ok") return <StudioForbidden />;
  const { artist, session, can } = access;

  const repo = getRepository();
  const page = { page: 1, pageSize: 200 };
  const [{ releases }, { scenes }, { experiences }, { campaigns }, { assets }] = await Promise.all([
    repo.release.listByArtist(artist.id, page),
    repo.scene.listByArtist(artist.id, page),
    repo.experience.listByArtist(artist.id, page),
    repo.campaign.listByArtist(artist.id, page),
    repo.media.listByArtist(artist.id, page),
  ]);

  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const participants = campaigns.reduce((sum, c) => sum + c.participantCount, 0);
  const artworks = campaigns.reduce((sum, c) => sum + c.artworkCount, 0);
  const unpublished = experiences.filter((e) => !e.currentVersionId);

  const stats = [
    { label: "Active campaigns", value: activeCampaigns.length },
    { label: "Participants", value: participants },
    { label: "Fan artworks", value: artworks },
    { label: "Published experiences", value: experiences.length - unpublished.length },
  ];

  return (
    <>
      <StudioPageHeader
        eyebrow={session.role === "artist_editor" ? "Editor" : session.role === "platform_admin" ? "Platform admin" : "Artist admin"}
        title={artist.name}
        description="Build scenes, publish interactive experiences, and run fan campaigns."
        actions={
          <>
            <Link href="/studio/scenes" className="h-9 inline-flex items-center px-4 text-sm font-semibold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]">
              New scene
            </Link>
            <Link href={`/artists/${artist.slug}`} className="h-9 inline-flex items-center px-4 text-sm border border-[var(--color-border-strong)] hover:border-[var(--color-fg)]">
              View public profile
            </Link>
          </>
        }
      />

      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--color-border)] border border-[var(--color-border)] mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-[var(--color-bg-secondary)] px-4 py-5">
            <dt className="text-xs font-mono uppercase tracking-widest text-[var(--color-fg-muted)]">{s.label}</dt>
            <dd className="mt-2 text-3xl font-semibold tabular-nums">{formatCount(s.value)}</dd>
          </div>
        ))}
      </dl>

      {!can("experience.publish") && (
        <p className="mb-6 text-sm text-[var(--color-fg-muted)]">
          You can create and edit drafts. Publishing and identity changes need an artist admin.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Campaigns" actions={<Link href="/studio/campaigns" className="text-xs underline underline-offset-4">All</Link>}>
          {campaigns.length === 0 ? (
            <EmptyState title="No campaigns yet" />
          ) : (
            <div className="-m-4">
              {campaigns.slice(0, 5).map((c) => (
                <RowLink key={c.id} href={`/studio/campaigns/${c.id}`}>
                  <span className="min-w-0 truncate text-sm">{c.title}</span>
                  <span className="flex items-center gap-3 text-xs text-[var(--color-fg-muted)]">
                    {formatCount(c.participantCount)} participants <StatusBadge status={c.status} />
                  </span>
                </RowLink>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Experiences" actions={<Link href="/studio/experiences" className="text-xs underline underline-offset-4">All</Link>}>
          {experiences.length === 0 ? (
            <EmptyState title="No experiences yet" />
          ) : (
            <div className="-m-4">
              {experiences.slice(0, 5).map((e) => (
                <RowLink key={e.id} href={`/studio/experiences/${e.id}`}>
                  <span className="min-w-0 truncate text-sm">{e.title}</span>
                  <span className="flex items-center gap-3 text-xs text-[var(--color-fg-muted)]">
                    {e.scenes.length} scenes <StatusBadge status={e.currentVersionId ? "published" : "draft"} />
                  </span>
                </RowLink>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Releases" actions={<Link href="/studio/releases" className="text-xs underline underline-offset-4">All</Link>}>
          {releases.length === 0 ? (
            <EmptyState title="No releases yet" />
          ) : (
            <div className="-m-4">
              {releases.slice(0, 5).map((r) => (
                <RowLink key={r.id} href={`/studio/releases/${r.id}`}>
                  <span className="min-w-0 truncate text-sm">{r.title}</span>
                  <span className="flex items-center gap-3 text-xs text-[var(--color-fg-muted)]">
                    {formatDate(r.releaseDate)} <StatusBadge status={r.status} />
                  </span>
                </RowLink>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Library">
          <ul className="grid grid-cols-2 gap-4 text-sm">
            <li>
              <Link href="/studio/scenes" className="block hover:underline underline-offset-4">
                <span className="text-2xl font-semibold tabular-nums block">{scenes.length}</span>
                <span className="text-[var(--color-fg-muted)]">Scenes</span>
              </Link>
            </li>
            <li>
              <Link href="/studio/media" className="block hover:underline underline-offset-4">
                <span className="text-2xl font-semibold tabular-nums block">{assets.length}</span>
                <span className="text-[var(--color-fg-muted)]">Media assets</span>
              </Link>
            </li>
          </ul>
          {unpublished.length > 0 && (
            <p className="mt-4 text-xs text-[var(--color-fg-muted)]">
              {unpublished.length} experience{unpublished.length > 1 ? "s" : ""} not yet published.
            </p>
          )}
        </Panel>
      </div>
    </>
  );
}
