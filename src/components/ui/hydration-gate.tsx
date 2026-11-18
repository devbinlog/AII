"use client";

import { useEffect, useState, type ReactNode } from "react";

/** True after the first client commit (false during SSR and before hydration). */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

/**
 * Server-rendered editors look usable before React attaches their handlers: a click
 * is lost, typing into a controlled input is wiped by hydration. Wrap such an editor
 * directly (no Suspense boundary in between) so every control inside stays natively
 * disabled until it actually works. Links still navigate.
 *
 * Child effects run before this one in the same commit, so the controls unlock only
 * once the wrapped editor has hydrated.
 */
export function HydrationGate({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  return (
    <fieldset disabled={!hydrated} aria-busy={!hydrated} data-hydrated={hydrated ? "" : undefined} className="contents">
      {children}
    </fieldset>
  );
}
