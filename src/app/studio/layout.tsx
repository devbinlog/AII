import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { hasStudioAccess } from "@/lib/studio/policy";
import { StudioNav } from "@/components/studio/studio-nav";

export const metadata: Metadata = {
  title: { default: "Artist Studio", template: "%s — Artist Studio | AII" },
  robots: { index: false, follow: false },
};

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  // Each page re-checks access on the server; this only decides whether to show the shell.
  const session = await getSession();
  const showShell = hasStudioAccess(session);

  return (
    <div className="studio flex-1 bg-[var(--color-bg)] text-[var(--color-fg)]">
      {showShell ? (
        <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-6 md:py-8 flex flex-col md:flex-row gap-6 md:gap-8">
          <aside className="md:w-48 shrink-0">
            <Link href="/studio" className="hidden md:block mb-4 text-xs font-mono font-semibold uppercase tracking-widest text-[var(--color-accent-fg)]">
              Artist Studio
            </Link>
            <StudioNav />
          </aside>
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      ) : (
        <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-10">{children}</div>
      )}
    </div>
  );
}
