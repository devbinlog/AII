// Artwork access rules shared by the artwork API routes.
// Mirrors the server-rendered artwork detail page: an artwork with no
// creatorId (anonymous) has no logged-in owner until it is claimed.

import type {
  ArtworkPermission,
  ArtworkStatus,
  FanArtwork,
  Session,
} from "@/types";

export const ARTWORK_PERMISSIONS: readonly ArtworkPermission[] = ["public", "unlisted", "private"];
export const ARTWORK_STATUSES: readonly ArtworkStatus[] = ["draft", "saved", "published", "flagged", "removed"];

/** Statuses a creator may set on their own artwork. */
const CREATOR_SETTABLE_STATUSES: readonly ArtworkStatus[] = ["draft", "saved", "published"];
/** Statuses set by moderation; creators cannot change status out of them. */
const MODERATION_STATUSES: readonly ArtworkStatus[] = ["flagged", "removed"];

const TITLE_MAX_LENGTH = 200;

export function isArtworkOwner(artwork: FanArtwork, session: Session | null): boolean {
  return session !== null && artwork.creatorId !== null && artwork.creatorId === session.userId;
}

export function isPlatformAdmin(session: Session | null): boolean {
  return session !== null && session.role === "platform_admin";
}

export function isSessionValid(session: Session | null): session is Session {
  return session !== null && new Date(session.expiresAt) >= new Date();
}

/** Whether the artwork may be shown to this viewer (null = anonymous). */
export function canViewArtwork(artwork: FanArtwork, session: Session | null): boolean {
  if (artwork.status === "removed") return false;
  if (artwork.permission === "private") return isArtworkOwner(artwork, session);
  return true;
}

export function canEditArtwork(artwork: FanArtwork, session: Session | null): boolean {
  return isArtworkOwner(artwork, session) || isPlatformAdmin(session);
}

export function canDeleteArtwork(artwork: FanArtwork, session: Session | null): boolean {
  return isArtworkOwner(artwork, session);
}

export type ArtworkUpdate = Partial<Pick<FanArtwork, "title" | "imageUrl" | "permission" | "status" | "customization">>;

export type ArtworkUpdateResult =
  | { ok: true; update: ArtworkUpdate }
  | { ok: false; status: 400 | 403; code: string; message: string };

/**
 * Validates a PATCH body against the artwork's current state and the
 * caller's role. Only whitelisted fields with valid values pass through.
 */
export function validateArtworkUpdate(
  body: unknown,
  artwork: FanArtwork,
  session: Session
): ArtworkUpdateResult {
  const invalid = (message: string): ArtworkUpdateResult => ({ ok: false, status: 400, code: "INVALID_INPUT", message });

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return invalid("Request body must be a JSON object");
  }
  const input = body as Record<string, unknown>;
  const update: ArtworkUpdate = {};

  if ("title" in input) {
    if (typeof input.title !== "string" || input.title.trim().length === 0 || input.title.length > TITLE_MAX_LENGTH) {
      return invalid(`title must be a non-empty string of at most ${TITLE_MAX_LENGTH} characters`);
    }
    update.title = input.title.trim();
  }

  if ("imageUrl" in input) {
    if (input.imageUrl !== null && typeof input.imageUrl !== "string") {
      return invalid("imageUrl must be a string or null");
    }
    update.imageUrl = input.imageUrl;
  }

  if ("permission" in input) {
    if (!ARTWORK_PERMISSIONS.includes(input.permission as ArtworkPermission)) {
      return invalid(`permission must be one of: ${ARTWORK_PERMISSIONS.join(", ")}`);
    }
    update.permission = input.permission as ArtworkPermission;
  }

  if ("status" in input) {
    const next = input.status as ArtworkStatus;
    if (!ARTWORK_STATUSES.includes(next)) {
      return invalid(`status must be one of: ${ARTWORK_STATUSES.join(", ")}`);
    }
    if (!isPlatformAdmin(session)) {
      if (MODERATION_STATUSES.includes(artwork.status)) {
        return { ok: false, status: 403, code: "MODERATION_LOCKED", message: "Artwork status is locked by moderation" };
      }
      if (!CREATOR_SETTABLE_STATUSES.includes(next)) {
        return { ok: false, status: 403, code: "FORBIDDEN", message: "Status can only be set by moderation" };
      }
    }
    update.status = next;
  }

  if ("customization" in input) {
    if (typeof input.customization !== "object" || input.customization === null || Array.isArray(input.customization)) {
      return invalid("customization must be an object");
    }
    update.customization = input.customization as FanArtwork["customization"];
  }

  return { ok: true, update };
}
