"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useSession } from "@/components/auth/session-provider";
import type { ClientSession } from "@/lib/auth/client";

/** Display-only role helpers. Access is enforced on the server, never by the navbar. */
export function showsStudio(session: ClientSession | null): boolean {
  if (!session) return false;
  if (session.role === "platform_admin") return true;
  return (session.role === "artist_admin" || session.role === "artist_editor") && session.artistId !== null;
}

const ROLE_LABEL: Record<string, string> = {
  fan: "Fan",
  artist_editor: "Artist editor",
  artist_admin: "Artist admin",
  platform_admin: "Platform admin",
  platform_owner: "Platform owner",
};

function initials(name: string | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function useSignOut() {
  const { signOut } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  return async () => {
    await signOut();
    // Leave pages that require a session
    if (pathname.startsWith("/studio") || pathname.startsWith("/me")) router.push("/");
  };
}

/** Primary destination for the signed-in role: Studio for artist teams, My Artworks for fans. */
function primaryLink(session: ClientSession): { href: string; label: string } {
  return showsStudio(session) ? { href: "/studio", label: "Studio" } : { href: "/me/artworks", label: "My Artworks" };
}

export function DesktopNavAuth() {
  const { session } = useSession();
  const pathname = usePathname();
  const handleSignOut = useSignOut();

  if (!session) {
    const redirect = pathname && pathname !== "/login" ? `?redirect=${encodeURIComponent(pathname)}` : "";
    return (
      <Link href={`/login${redirect}`} className="hidden md:inline-flex text-sm font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors">
        Sign in
      </Link>
    );
  }

  const primary = primaryLink(session);
  return (
    <div className="hidden md:flex items-center gap-3">
      <Link
        href={primary.href}
        className={
          showsStudio(session)
            ? "inline-flex h-8 items-center px-3 text-sm font-semibold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
            : "text-sm font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
        }
      >
        {primary.label}
      </Link>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger
          aria-label={`Account menu for ${session.displayName ?? "your account"}`}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border-strong)] text-xs font-semibold text-[var(--color-fg)] hover:border-[var(--color-fg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-fg)]"
        >
          <span aria-hidden="true">{initials(session.displayName)}</span>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="z-[calc(var(--z-sticky)+1)] min-w-56 border border-[var(--color-border)] bg-[var(--color-bg)] p-1 text-sm text-[var(--color-fg)] shadow-lg"
          >
            <div className="px-3 py-2">
              <p className="font-medium truncate">{session.displayName ?? "Signed in"}</p>
              {session.email && <p className="text-xs text-[var(--color-fg-muted)] truncate">{session.email}</p>}
              <p className="mt-1 text-[11px] font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">{ROLE_LABEL[session.role] ?? session.role}</p>
            </div>
            <DropdownMenu.Separator className="my-1 h-px bg-[var(--color-border)]" />
            {showsStudio(session) && (
              <DropdownMenu.Item asChild>
                <Link href="/studio" className="block px-3 py-2 outline-none data-[highlighted]:bg-[var(--color-bg-secondary)]">Artist Studio</Link>
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Item asChild>
              <Link href="/me/artworks" className="block px-3 py-2 outline-none data-[highlighted]:bg-[var(--color-bg-secondary)]">My Artworks</Link>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-[var(--color-border)]" />
            <DropdownMenu.Item
              onSelect={() => void handleSignOut()}
              className="cursor-pointer px-3 py-2 text-[var(--color-accent)] outline-none data-[highlighted]:bg-[var(--color-bg-secondary)]"
            >
              Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

export function MobileNavAuth({ onDone }: { onDone: () => void }) {
  const { session } = useSession();
  const handleSignOut = useSignOut();

  if (!session) {
    return (
      <Link href="/login" className="py-3 text-base font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors">
        Sign in
      </Link>
    );
  }
  return (
    <>
      <div className="py-2">
        <p className="text-base font-medium text-[var(--color-fg)]">{session.displayName ?? "Signed in"}</p>
        <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">{ROLE_LABEL[session.role] ?? session.role}</p>
      </div>
      {showsStudio(session) && (
        <Link href="/studio" className="inline-flex h-12 items-center justify-center px-6 text-base font-semibold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors">
          Studio
        </Link>
      )}
      <Link href="/me/artworks" className="py-3 text-base font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors">
        My Artworks
      </Link>
      <button
        type="button"
        onClick={() => {
          onDone();
          void handleSignOut();
        }}
        className="py-3 text-left text-base font-medium text-[var(--color-accent)]">
        Sign out
      </button>
    </>
  );
}
