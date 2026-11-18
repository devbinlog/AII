import type { Metadata } from "next";
import { ArtistLogo } from "@/components/brand/artist-logo";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { hasStudioAccess, resolveStudioArtistId } from "@/lib/studio/policy";
import { getRepository } from "@/lib/repository";
import { MOCK_IDS } from "@/lib/mock/fixtures";
import { StudioNav } from "@/components/studio/studio-nav";
import { StudioStatus } from "@/components/studio/studio-status";

export const metadata: Metadata = {
  title: { default: "Artist Studio", template: "%s — Artist Studio | AII" },
  robots: { index: false, follow: false },
};

const ROLE_LABEL: Record<string, string> = {
  artist_editor: "Artist editor",
  artist_admin: "Artist admin",
  platform_admin: "Platform admin",
  platform_owner: "Platform owner",
};

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  // Each page re-checks access on the server; this only decides whether to show the shell.
  const session = await getSession();
  const showShell = hasStudioAccess(session);
  const artistId = showShell ? resolveStudioArtistId(session, MOCK_IDS.ARTIST_FREEFALLERS) : null;
  const artist = artistId ? await getRepository().artist.findById(artistId) : null;

  return (
    <div className="studio flex-1 bg-[var(--color-bg)] text-[var(--color-fg)]">
      {showShell ? (
        <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-6 md:py-8 flex flex-col md:flex-row gap-6 md:gap-8">
          <aside className="studio-sidebar md:w-52 shrink-0 md:self-start flex flex-col gap-5" aria-label="Studio sidebar">
            <Link href="/studio" className="hidden md:block text-xs font-mono font-semibold uppercase tracking-widest text-[var(--color-accent-fg)]">
              Artist Studio
            </Link>

            {artist && (
              // Artist-owned surface: the artist's own colours, not the platform's.
              <div className="hidden md:block border border-[var(--color-border)]">
                <div className="h-10 relative overflow-hidden" style={{ backgroundColor: artist.branding.backgroundColor }} aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="absolute inset-y-0 w-px" style={{ left: `${20 + i * 22}%`, backgroundColor: artist.branding.primaryColor, opacity: 0.25 + i * 0.12 }} />
                  ))}
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full" style={{ backgroundColor: artist.branding.primaryColor }} />
                </div>
                <div className="p-3">
                  <ArtistLogo branding={artist.branding} artistName={artist.name} size="sm" color="var(--color-fg)" className="max-w-full" />
                  <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">{ROLE_LABEL[session.role] ?? session.role}</p>
                  <Link href={`/artists/${artist.slug}`} className="mt-2 inline-block text-xs text-[var(--color-fg-muted)] underline underline-offset-4 hover:text-[var(--color-fg)]">
                    View public profile →
                  </Link>
                </div>
              </div>
            )}

            <StudioNav />

            <div className="hidden md:flex flex-col gap-5">
              <StudioStatus />
              {artist && (
                <section aria-label="Public pages" className="border-t border-[var(--color-border)] pt-4">
                  <h2 className="caption-label text-[var(--color-fg-subtle)]">See it as fans do</h2>
                  <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                    <li>
                      <Link href={`/artists/${artist.slug}`} className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">Artist profile ↗</Link>
                    </li>
                    <li>
                      <Link href="/stage" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">Live stage ↗</Link>
                    </li>
                    <li>
                      <Link href="/explore" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">Explore ↗</Link>
                    </li>
                  </ul>
                </section>
              )}
            </div>
          </aside>
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      ) : (
        <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-10">{children}</div>
      )}
    </div>
  );
}
