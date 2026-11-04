// Synchronous cookie utilities — no Server Action, safe to import in API routes.

export const SESSION_COOKIE_NAME = "aii_session";

export function getSessionTokenFromCookieHeader(cookieHeader: string): string | null {
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return match?.[1] ?? null;
}
