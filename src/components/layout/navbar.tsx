"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils/cn";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close mobile menu on Escape key
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[var(--z-sticky)] border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[var(--container-2xl)] px-6 h-14 flex items-center justify-between">
          {/* Wordmark */}
          <Link
            href="/"
            className="text-lg font-black tracking-[-0.04em] uppercase text-[var(--color-fg)] hover:text-[var(--color-accent)] transition-colors"
            aria-label="AII — Home"
          >
            AII
          </Link>

          {/* Primary nav — desktop only */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Primary navigation">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "text-sm font-medium transition-colors",
                  pathname === href
                    ? "text-[var(--color-fg)]"
                    : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Desktop actions */}
            <Link
              href="/login"
              className="hidden md:inline-flex text-sm font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/studio"
              className="hidden md:inline-flex h-8 items-center px-3 text-sm font-semibold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              Studio
            </Link>

            {/* Mobile menu toggle */}
            <button
              type="button"
              className="md:hidden flex items-center justify-center w-9 h-9 text-[var(--color-fg)] hover:text-[var(--color-accent)] transition-colors"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              onClick={() => setMobileOpen((v) => !v)}
            >
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                {mobileOpen ? (
                  // X icon
                  <>
                    <line x1="4" y1="4" x2="20" y2="20" />
                    <line x1="20" y1="4" x2="4" y2="20" />
                  </>
                ) : (
                  // Hamburger icon
                  <>
                    <line x1="3" y1="7" x2="21" y2="7" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="17" x2="21" y2="17" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div
          id="mobile-menu"
          className="fixed inset-0 z-[calc(var(--z-sticky)-1)] md:hidden"
          style={{ backgroundColor: "#0a0a0a" }}
        >
          {/* Spacer for fixed navbar */}
          <div className="h-14 border-b border-[var(--color-border)]" />

          <nav
            className="flex flex-col px-6 pt-8 pb-10 gap-1"
            aria-label="Mobile navigation"
          >
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "py-4 text-2xl font-semibold tracking-tight border-b border-[var(--color-border)] transition-colors",
                  pathname === href
                    ? "text-[var(--color-fg)]"
                    : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                )}
              >
                {label}
              </Link>
            ))}

            {/* Divider */}
            <div className="mt-6 pt-6 flex flex-col gap-4">
              <Link
                href="/login"
                className="py-3 text-base font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/studio"
                className="inline-flex h-12 items-center justify-center px-6 text-base font-semibold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
              >
                Studio
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
