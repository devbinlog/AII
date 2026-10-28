import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] mt-auto">
      <div className="mx-auto max-w-[var(--container-2xl)] px-6 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black tracking-[-0.04em] uppercase text-[var(--color-fg)]">
              AII
            </p>
            <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
              Make Your Sound Visible.
            </p>
          </div>

          <nav className="flex flex-wrap gap-4 text-xs text-[var(--color-fg-muted)]" aria-label="Footer navigation">
            <Link href="/explore" className="hover:text-[var(--color-fg)] transition-colors">
              Explore
            </Link>
            <Link href="/studio" className="hover:text-[var(--color-fg)] transition-colors">
              Artist Studio
            </Link>
            <Link href="/terms" className="hover:text-[var(--color-fg)] transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-[var(--color-fg)] transition-colors">
              Privacy
            </Link>
          </nav>
        </div>

        <div className="mt-6 pt-6 border-t border-[var(--color-border)] flex items-center justify-between">
          <p className="text-xs text-[var(--color-fg-subtle)]">
            © 2026 AII. Artist Identity Interactive.
          </p>
          <p className="text-xs text-[var(--color-fg-subtle)]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] mr-1.5 align-middle" />
            MOCK MODE
          </p>
        </div>
      </div>
    </footer>
  );
}
