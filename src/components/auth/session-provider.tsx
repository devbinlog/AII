"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
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

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ClientSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    try {
      const s = await fetchSession();
      setSession(s);
    } catch {
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const signOut = async () => {
    await clientSignOut();
    setSession(null);
  };

  return (
    <SessionContext.Provider value={{ session, isLoading, signOut, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}
