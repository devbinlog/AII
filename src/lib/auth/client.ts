"use client";

// Client-side auth utilities (no cookies() call — server only)
// Use these in client components to manage auth state via API calls.

export interface ClientSession {
  userId: string;
  role: string;
  artistId: string | null;
  expiresAt: string;
  /** Display info for the navbar; not used for authorization. */
  displayName?: string;
  email?: string;
}

export async function fetchSession(): Promise<ClientSession | null> {
  const res = await fetch("/api/auth/session", { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json() as { session?: ClientSession | null; user?: { displayName: string; email: string } | null };
  if (!data.session) return null;
  return { ...data.session, ...(data.user ? { displayName: data.user.displayName, email: data.user.email } : {}) };
}

export async function signIn(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });
  const data = await res.json() as { ok?: boolean; error?: { message?: string } };
  if (!res.ok) return { ok: false, error: (data.error as { message?: string })?.message ?? "Login failed" };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
}
