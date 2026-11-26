"use client";

// Protects unsaved Studio edits.
// - Reload, tab close, typed URL, external link: the browser's beforeunload prompt.
// - In-app links (Studio sidebar, breadcrumbs, any <a> on the page): a confirm
//   before the client-side navigation starts. The App Router has no navigation
//   blocking API, so the click is intercepted in the capture phase, before
//   next/link's handler runs.
// Browser back/forward inside the app is not intercepted.

import { useEffect, useRef } from "react";

export const UNSAVED_LEAVE_MESSAGE = "You have unsaved changes. Leave this page without saving?";

function isPlainNavigation(event: MouseEvent, anchor: HTMLAnchorElement): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return true; // leaving the app: still worth a prompt
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

export function useUnsavedChanges(dirty: boolean): void {
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers need a returnValue to show the prompt.
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current) return;
      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor || !isPlainNavigation(e, anchor)) return;
      if (window.confirm(UNSAVED_LEAVE_MESSAGE)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);
}
