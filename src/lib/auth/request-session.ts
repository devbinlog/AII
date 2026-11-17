// Resolve the caller's session from an API request's cookie header.
// Returns null when there is no cookie, no matching session, or it has expired.

import type { NextRequest } from "next/server";
import { getRepository } from "@/lib/repository";
import { getSessionTokenFromCookieHeader } from "@/lib/auth/cookie";
import { isSessionValid } from "@/lib/auth/artwork-access";
import type { Session } from "@/types";

export async function getRequestSession(req: NextRequest): Promise<Session | null> {
  const token = getSessionTokenFromCookieHeader(req.headers.get("cookie") ?? "");
  if (!token) return null;
  const session = await getRepository().auth.getSession(token);
  return isSessionValid(session) ? session : null;
}
