"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientSession } from "@/lib/auth/client";
import { fetchSession, signOut as clientSignOut } from "@/lib/auth/client";

interface SessionContextValue {
  session: ClientSession | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  isLoading: true,
  signOut: async () => {},
  refresh: async () => {},
});

/**
 * Holds the session for UI only (navbar, menus). Authorization always happens on
 * the server. `initialSession` comes from the server-validated cookie, so the
 * correct state renders on first paint and survives reloads.
 */
export function SessionProvider({ children, initialSession }: { children: React.ReactNode; initialSession: ClientSession | null }) {
  const router = useRouter();
  const [session, setSession] = useState<ClientSession | null>(initialSession);
  const [isLoading, setIsLoading] = useState(false);

  // Server re-render (router.refresh after sign-in/out) delivers a new initial session.
  useEffect(() => {
    setSession(initialSession);
  }, [initialSession]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setSession(await fetchSession());
    } catch {
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await clientSignOut();
    setSession(null);
    router.refresh();
  }, [router]);

  return <SessionContext.Provider value={{ session, isLoading, signOut, refresh }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}
