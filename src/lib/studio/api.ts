// Server-side guard for /api/studio/* route handlers.

import { type NextRequest, NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/request-session";
import { canPerform, hasStudioAccess, ownsResource, resolveStudioArtistId, type StudioAction } from "./policy";
import type { Session } from "@/types";

export interface StudioContext {
  session: Session;
  artistId: string;
}

export function apiError(code: string, status: number, message?: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, ...(message ? { message } : {}), ...(details !== undefined ? { details } : {}) } },
    { status }
  );
}

/**
 * Authenticates and authorizes a Studio API call.
 * Returns the context, or a ready-to-return error response.
 * 401: no session · 403: no Studio role or action not allowed · 400: admin without artistId
 */
export async function requireStudio(
  req: NextRequest,
  action: StudioAction
): Promise<StudioContext | NextResponse> {
  const session = await getRequestSession(req);
  if (!session) return apiError("UNAUTHORIZED", 401);
  if (!hasStudioAccess(session)) return apiError("FORBIDDEN", 403, "Artist Studio access required");
  if (!canPerform(session, action)) return apiError("FORBIDDEN", 403, `Your role cannot perform ${action}`);
  const requested = req.nextUrl.searchParams.get("artistId");
  const artistId = resolveStudioArtistId(session, requested);
  if (!artistId) return apiError("INVALID_INPUT", 400, "artistId query parameter is required");
  return { session, artistId };
}

export function isResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

/** 404 unless the resource exists and belongs to the acting artist (no existence leak). */
export function notOwned<T extends { artistId: string }>(ctx: StudioContext, resource: T | null): resource is null {
  return !ownsResource(ctx.artistId, resource);
}

export async function readJson(req: NextRequest): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  try {
    return { ok: true, body: await req.json() };
  } catch {
    return { ok: false, response: apiError("INVALID_INPUT", 400, "Request body must be valid JSON") };
  }
}
