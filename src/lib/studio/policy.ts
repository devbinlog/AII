// Artist Studio authorization policy (pure — no I/O).
// See docs/WS-05-artist-studio-plan.md §1a for the matrix.

import type { Session, UserRole } from "@/types";

export type StudioAction =
  | "studio.view"        // open Studio, view own artist data and analytics
  | "content.edit"       // create/edit drafts: scenes, experiences, releases, campaigns; upload media
  | "identity.edit"      // edit artist profile / branding
  | "release.publish"
  | "experience.publish"
  | "campaign.publish"   // activate / end campaigns
  | "stage.publish"      // publish / unpublish the public 3D stage
  | "media.delete";

const EDITOR_ACTIONS: ReadonlySet<StudioAction> = new Set(["studio.view", "content.edit"]);
const ARTIST_ROLES: ReadonlySet<UserRole> = new Set(["artist_editor", "artist_admin"]);

export function isPlatformStaff(session: Session): boolean {
  return session.role === "platform_admin";
}

export function hasStudioAccess(session: Session | null): session is Session {
  if (!session) return false;
  if (isPlatformStaff(session)) return true;
  return ARTIST_ROLES.has(session.role) && session.artistId !== null;
}

/**
 * Resolves which artist the session acts for.
 * Artist roles are pinned to their own artist (any requested id is ignored);
 * platform admins may act for the requested artist.
 */
export function resolveStudioArtistId(session: Session, requestedArtistId?: string | null): string | null {
  if (isPlatformStaff(session)) return requestedArtistId ?? null;
  return session.artistId;
}

export function canPerform(session: Session | null, action: StudioAction): boolean {
  if (!hasStudioAccess(session)) return false;
  if (isPlatformStaff(session) || session.role === "artist_admin") return true;
  return EDITOR_ACTIONS.has(action);
}

/** Resource belongs to the artist the session acts for. */
export function ownsResource(artistId: string | null, resource: { artistId: string } | null | undefined): boolean {
  return artistId !== null && resource != null && resource.artistId === artistId;
}
