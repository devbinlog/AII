export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import { getRepository } from "@/lib/repository";
import { getStudioAccess } from "@/lib/studio/session";
import { StudioForbidden } from "@/components/studio/studio-forbidden";
import { DemoNotice, EmptyState, Panel, StatusBadge, StudioPageHeader } from "@/components/studio/ui";
import { formatCount } from "@/lib/utils/format";
import { DailyChart } from "./_components/daily-chart";

export const metadata: Metadata = { title: "Analytics" };

function Breakdown({ rows, unit }: { rows: { label: string; value: number }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[96px_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate capitalize text-[var(--color-fg)]">{r.label}</span>
          <span className="h-3" aria-hidden="true">
            <span className="block h-full rounded-r-[4px] bg-[var(--color-accent)]" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="tabular-nums text-[var(--color-fg-muted)]">
            {formatCount(r.value)}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function StudioAnalyticsPage({ searchParams }: { searchParams: Promise<{ campaign?: string }> }) {
  const access = await getStudioAccess("/studio/analytics");
  if (access.status !== "ok") return <StudioForbidden />;
  const repo = getRepository();
  const { campaigns } = await repo.campaign.listByArtist(access.artist.id, { page: 1, pageSize: 200 });
  const live = campaigns.filter((c) => c.status !== "draft");
  const requested = (await searchParams).campaign;
  // Only this artist's campaigns can be selected; anything else falls back to the first.
  const campaign = live.find((c) => c.id === requested) ?? live[0] ?? null;

  if (!campaign) {
    return (
      <>
        <StudioPageHeader eyebrow="Analytics" title="Analytics" />
        <EmptyState title="No live campaigns yet">Analytics appear once a campaign goes live.</EmptyState>
      </>
    );
  }

  const to = new Date();
  const from = new Date(to.getTime() - 28 * 86400000);
  const summary = await repo.analytics.getCampaignSummary(campaign.id, from.toISOString(), to.toISOString());
  const minutes = Math.round(summary.avgTimeOnExperienceMs / 60000);

  const tiles = [
    { label: "Participants", value: formatCount(summary.totalParticipants) },
    { label: "Unique visitors", value: formatCount(summary.uniqueVisitors) },
    { label: "Artworks created", value: formatCount(summary.artworksCreated) },
    { label: "Avg. time in experience", value: `${minutes} min` },
  ];

  return (
    <>
      <StudioPageHeader eyebrow="Analytics" title={campaign.title} description="Last 28 days" actions={<StatusBadge status={campaign.status} />} />
      <div className="flex flex-col gap-6">
        <DemoNotice>DEMO — analytics are generated sample data, not real visitor tracking.</DemoNotice>

        {live.length > 1 && (
          <nav aria-label="Campaign" className="flex flex-wrap gap-2">
            {live.map((c) => (
              <Link
                key={c.id}
                href={`/studio/analytics?campaign=${c.id}`}
                aria-current={c.id === campaign.id ? "page" : undefined}
                className={`px-3 py-1.5 text-xs border ${c.id === campaign.id ? "border-[var(--color-fg)]" : "border-[var(--color-border)] text-[var(--color-fg-muted)]"}`}
              >
                {c.title}
              </Link>
            ))}
          </nav>
        )}

        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--color-border)] border border-[var(--color-border)]">
          {tiles.map((t) => (
            <div key={t.label} className="bg-[var(--color-bg-secondary)] px-4 py-5">
              <dt className="text-xs font-mono uppercase tracking-widest text-[var(--color-fg-muted)]">{t.label}</dt>
              <dd className="mt-2 text-3xl font-semibold tabular-nums">{t.value}</dd>
            </div>
          ))}
        </dl>

        <Panel title="Participation">
          <DailyChart data={summary.participationByDay} />
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Devices">
            <Breakdown rows={Object.entries(summary.deviceBreakdown).map(([label, value]) => ({ label, value }))} unit="%" />
          </Panel>
          <Panel title="Top referrers">
            <Breakdown rows={summary.topReferrers.map((r) => ({ label: r.source, value: r.count }))} unit="" />
          </Panel>
        </div>

        <p className="text-xs text-[var(--color-fg-muted)]">
          {formatCount(summary.artworksPublished)} artworks published · {formatCount(summary.shareCount)} shares
        </p>
      </div>
    </>
  );
}
