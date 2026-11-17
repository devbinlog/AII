// Server-side guard for /studio pages (server components).

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getRepository } from "@/lib/repository";
import { canPerform, hasStudioAccess, resolveStudioArtistId, type StudioAction } from "./policy";
import { MOCK_IDS } from "@/lib/mock/fixtures";
import type { Artist, Session } from "@/types";

export type StudioPageAccess =
  | { status: "ok"; session: Session; artist: Artist; can: (action: StudioAction) => boolean }
  | { status: "forbidden" };

/**
 * Anonymous → redirect to login. Signed in without a Studio role → "forbidden".
 * Platform admins act for `?artist=` (defaults to the first official artist).
 */
export async function getStudioAccess(returnTo: string, requestedArtistId?: string | null): Promise<StudioPageAccess> {
  const session = await getSession();
  if (!session) redirect(`/login?redirect=${encodeURIComponent(returnTo)}`);
  if (!hasStudioAccess(session)) return { status: "forbidden" };

  const artistId = resolveStudioArtistId(session, requestedArtistId ?? MOCK_IDS.ARTIST_FREEFALLERS);
  const artist = artistId ? await getRepository().artist.findById(artistId) : null;
  if (!artist) return { status: "forbidden" };

  return { status: "ok", session, artist, can: (action) => canPerform(session, action) };
}
