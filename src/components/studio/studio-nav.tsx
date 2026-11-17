"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export const STUDIO_NAV = [
  { href: "/studio", label: "Dashboard" },
  { href: "/studio/identity", label: "Identity" },
  { href: "/studio/releases", label: "Releases" },
  { href: "/studio/media", label: "Media" },
  { href: "/studio/scenes", label: "Scenes" },
  { href: "/studio/experiences", label: "Experiences" },
  { href: "/studio/campaigns", label: "Campaigns" },
  { href: "/studio/analytics", label: "Analytics" },
  { href: "/studio/stage", label: "Stage 3D" },
] as const;

export function StudioNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Studio" className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0">
      {STUDIO_NAV.map((item) => {
        const active = item.href === "/studio" ? pathname === "/studio" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 whitespace-nowrap px-3 py-2 text-sm transition-colors border-l-2",
              active
                ? "border-[var(--color-accent)] text-[var(--color-fg)] bg-white/[0.04]"
                : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
