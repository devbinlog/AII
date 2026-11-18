"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { DesktopNavAuth, MobileNavAuth } from "./nav-auth";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/stage", label: "Stage" },
] as const;

const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`) || (href === "/stage" && /^\/artists\/[^/]+\/stage$/.test(pathname));

const MENU_ID = "mobile-menu";

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      {open ? (
        <>
          <line x1="4" y1="4" x2="20" y2="20" />
          <line x1="20" y1="4" x2="4" y2="20" />
        </>
      ) : (
        <>
          <line x1="3" y1="7" x2="21" y2="7" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="17" x2="21" y2="17" />
        </>
      )}
    </svg>
  );
}

/**
 * The mobile menu is a native HTML popover (`popovertarget`), so the browser opens
 * it even before React hydrates — a tap on a slow connection is never lost. Escape
 * and outside-tap dismissal are native too. React only adds scroll locking and
 * closing on navigation.
 */
export function Navbar() {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Mirror the popover's real state (it may already be open if tapped before hydration).
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const sync = () => setMobileOpen(el.matches(":popover-open"));
    sync();
    el.addEventListener("toggle", sync);
    return () => el.removeEventListener("toggle", sync);
  }, []);

  const closeMenu = useCallback(() => {
    const el = menuRef.current;
    if (el?.matches(":popover-open")) el.hidePopover();
  }, []);

  // Close on navigation — but not on first mount, which would undo a pre-hydration tap.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    closeMenu();
  }, [pathname, closeMenu]);

  // Prevent body scroll while the menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
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
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className={cn(
                  "text-sm font-medium transition-colors",
                  isActive(pathname, href) ? "text-[var(--color-fg)]" : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Desktop actions — reflect the server-validated session */}
            <DesktopNavAuth />

            {/* Mobile menu toggle: works natively, no JS required */}
            <button
              type="button"
              popoverTarget={MENU_ID}
              popoverTargetAction="show"
              className="md:hidden flex items-center justify-center w-9 h-9 text-[var(--color-fg)] hover:text-[var(--color-accent)] transition-colors"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              aria-controls={MENU_ID}
            >
              <MenuIcon open={false} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu: native popover in the top layer, on the Paper theme its text tokens are made for */}
      <div
        id={MENU_ID}
        ref={menuRef}
        popover="auto"
        className="md:hidden fixed inset-0 m-0 h-dvh w-full max-w-none max-h-none overflow-y-auto border-0 p-0 bg-[var(--color-bg)] text-[var(--color-fg)]"
      >
        <div className="h-14 px-6 flex items-center justify-between border-b border-[var(--color-border)]">
          <Link href="/" onClick={closeMenu} className="text-lg font-black tracking-[-0.04em] uppercase text-[var(--color-fg)]" aria-label="AII — Home">
            AII
          </Link>
          <button
            type="button"
            popoverTarget={MENU_ID}
            popoverTargetAction="hide"
            className="flex items-center justify-center w-9 h-9 text-[var(--color-fg)] hover:text-[var(--color-accent)] transition-colors"
            aria-label="Close menu"
          >
            <MenuIcon open />
          </button>
        </div>

        <nav className="flex flex-col px-6 pt-8 pb-10 gap-1" aria-label="Mobile navigation">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={closeMenu}
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className={cn(
                "py-4 text-2xl font-semibold tracking-tight border-b border-[var(--color-border)] transition-colors",
                isActive(pathname, href) ? "text-[var(--color-fg)]" : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              )}
            >
              {label}
            </Link>
          ))}

          <div className="mt-6 pt-6 flex flex-col gap-4">
            <MobileNavAuth onDone={closeMenu} />
          </div>
        </nav>
      </div>
    </>
  );
}
