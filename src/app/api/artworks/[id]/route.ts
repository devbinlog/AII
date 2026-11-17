import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { getRequestSession } from "@/lib/auth/request-session";
import {
  canDeleteArtwork,
  canEditArtwork,
  canViewArtwork,
  validateArtworkUpdate,
} from "@/lib/auth/artwork-access";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function error(code: string, status: number, message?: string) {
  return NextResponse.json({ ok: false, error: message ? { code, message } : { code } }, { status });
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const repo = getRepository();
  const artwork = await repo.artwork.findById(id);

  // Removed artworks are not accessible
  if (!artwork || artwork.status === "removed") return error("NOT_FOUND", 404);

  // PRIVATE artworks are visible only to their (logged-in) creator.
  // Anonymous artworks (creatorId === null) have no owner until claimed.
  const session = await getRequestSession(req);
  if (!canViewArtwork(artwork, session)) return error("FORBIDDEN", 403);

  return NextResponse.json({ ok: true, artwork });
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const session = await getRequestSession(req);
  if (!session) return error("UNAUTHORIZED", 401);

  const repo = getRepository();
  const artwork = await repo.artwork.findById(id);
  if (!artwork) return error("NOT_FOUND", 404);

  // Only the creator or a platform admin can update
  if (!canEditArtwork(artwork, session)) return error("FORBIDDEN", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("INVALID_INPUT", 400, "Request body must be valid JSON");
  }

  const result = validateArtworkUpdate(body, artwork, session);
  if (!result.ok) return error(result.code, result.status, result.message);

  const updated = await repo.artwork.update(id, result.update);
  return NextResponse.json({ ok: true, artwork: updated });
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const session = await getRequestSession(req);
  if (!session) return error("UNAUTHORIZED", 401);

  const repo = getRepository();
  const artwork = await repo.artwork.findById(id);
  if (!artwork) return error("NOT_FOUND", 404);
  if (!canDeleteArtwork(artwork, session)) return error("FORBIDDEN", 403);

  await repo.artwork.delete(id, session.userId);
  return NextResponse.json({ ok: true });
}
