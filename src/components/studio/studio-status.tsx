"use client";

// Studio sidebar "Live now" block. Client-fetched so it stays current: refetches on
// route change and after any successful Studio mutation (STUDIO_CHANGED_EVENT),
// because the Studio layout itself does not re-render between pages.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { STUDIO_CHANGED_EVENT, studioFetch } from "./client-api";

interface Status {
  stage: { live: boolean; version: number | null; hasDraft: boolean };
  campaigns: { live: number; total: number };
  releases: { published: number; draft: number };
}

async function loadStatus(): Promise<Status | null> {
  const [stage, campaigns, releases] = await Promise.all([
    studioFetch<{ saved: boolean; publication: { visibility: string; publishedVersionId: string | null } | null; versions: { id: string; version: number }[] }>("/api/studio/stage"),
    studioFetch<{ campaigns: { status: string }[] }>("/api/studio/campaigns"),
    studioFetch<{ releases: { status: string }[] }>("/api/studio/releases"),
  ]);
  if (!stage.ok || !campaigns.ok || !releases.ok) return null;
  const pubId = stage.data.publication?.visibility === "public" ? stage.data.publication.publishedVersionId : null;
  return {
    stage: { live: pubId !== null, version: stage.data.versions.find((v) => v.id === pubId)?.version ?? null, hasDraft: stage.data.saved },
    campaigns: { live: campaigns.data.campaigns.filter((c) => c.status === "active").length, total: campaigns.data.campaigns.length },
    releases: {
      published: releases.data.releases.filter((r) => r.status === "released").length,
      draft: releases.data.releases.filter((r) => r.status === "draft").length,
    },
  };
}

function Row({ href, label, value, live }: { href: string; label: string; value: string; live: boolean }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-3 py-1.5 text-sm hover:text-[var(--color-fg)] text-[var(--color-fg-muted)]">
        <span>{label}</span>
        <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
          <span className={live ? "h-1.5 w-1.5 rounded-full bg-[var(--aii-signal)]" : "h-1.5 w-1.5 rounded-full border border-[var(--color-fg-subtle)]"} aria-hidden="true" />
          <span className={live ? "text-[var(--color-fg)]" : ""}>{value}</span>
        </span>
      </Link>
    </li>
  );
}

export function StudioStatus() {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const refresh = () =>
      void loadStatus().then((s) => {
        if (!alive) return;
        setStatus(s);
        setFailed(s === null);
      });
    refresh();
    window.addEventListener(STUDIO_CHANGED_EVENT, refresh);
    return () => {
      alive = false;
      window.removeEventListener(STUDIO_CHANGED_EVENT, refresh);
    };
  }, [pathname]);

  return (
    <section aria-label="Live now" aria-live="polite" className="border-t border-[var(--color-border)] pt-4">
      <h2 className="caption-label text-[var(--color-fg-subtle)]">Live now</h2>
      {failed ? (
        <p className="mt-2 text-xs text-[var(--color-fg-muted)]">Status unavailable.</p>
      ) : !status ? (
        <ul className="mt-1" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="my-2 h-4 animate-pulse bg-[var(--color-bg-secondary)]" />
          ))}
        </ul>
      ) : (
        <ul className="mt-1 divide-y divide-[var(--color-border)]">
          <Row href="/studio/stage" label="Stage" live={status.stage.live} value={status.stage.live ? `Public v${status.stage.version ?? "?"}` : status.stage.hasDraft ? "Draft" : "Not set"} />
          <Row href="/studio/campaigns" label="Campaigns" live={status.campaigns.live > 0} value={`${status.campaigns.live} live`} />
          <Row href="/studio/releases" label="Releases" live={status.releases.published > 0} value={`${status.releases.published} out · ${status.releases.draft} draft`} />
        </ul>
      )}
    </section>
  );
}
