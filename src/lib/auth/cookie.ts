// Synchronous cookie utilities — no Server Action, safe to import in API routes.

export const SESSION_COOKIE_NAME = "aii_session";

export function getSessionTokenFromCookieHeader(cookieHeader: string): string | null {
  // Anchor to a cookie boundary so e.g. "xaii_session=" does not match.
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  return match?.[1] ?? null;
}
