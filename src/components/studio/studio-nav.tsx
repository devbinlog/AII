"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

/** Grouped on desktop; a single horizontal strip on phones. */
export const STUDIO_NAV_GROUPS = [
  { label: "Overview", items: [{ href: "/studio", label: "Dashboard" }, { href: "/studio/analytics", label: "Analytics" }] },
  { label: "Identity", items: [{ href: "/studio/identity", label: "Identity" }, { href: "/studio/media", label: "Media" }] },
  { label: "Music", items: [{ href: "/studio/releases", label: "Releases" }, { href: "/studio/scenes", label: "Scenes" }, { href: "/studio/experiences", label: "Experiences" }] },
  { label: "Fans & live", items: [{ href: "/studio/campaigns", label: "Campaigns" }, { href: "/studio/stage", label: "Stage 3D" }] },
] as const;

export const STUDIO_NAV: ReadonlyArray<{ href: string; label: string }> = STUDIO_NAV_GROUPS.flatMap((g): ReadonlyArray<{ href: string; label: string }> => g.items);

export function StudioNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/studio" ? pathname === "/studio" : pathname.startsWith(href));
  return (
    <nav aria-label="Studio" className="flex md:flex-col gap-1 md:gap-3 overflow-x-auto md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0">
      {STUDIO_NAV_GROUPS.map((group) => (
        <div key={group.label} className="contents md:block">
          <p className="hidden md:block mb-1 px-3 font-mono text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">{group.label}</p>
          <ul className="contents md:flex md:flex-col md:gap-0.5">
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href} className="contents md:block">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block shrink-0 whitespace-nowrap px-3 py-2 md:py-1.5 text-sm transition-colors border-l-2",
                      active
                        ? "border-[var(--color-accent)] text-[var(--color-fg)] bg-white/[0.04]"
                        : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
