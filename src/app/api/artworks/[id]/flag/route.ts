import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { getRequestSession } from "@/lib/auth/request-session";
import { canViewArtwork } from "@/lib/auth/artwork-access";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const session = await getRequestSession(req);
  if (!session) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });

  const repo = getRepository();
  const artwork = await repo.artwork.findById(id);
  // Artworks the caller cannot see are reported as not found (no existence leak)
  if (!artwork || !canViewArtwork(artwork, session)) {
    return NextResponse.json({ ok: false, error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  let reason = "unspecified";
  try {
    const body = (await req.json()) as { reason?: unknown };
    if (typeof body.reason === "string" && body.reason.trim()) reason = body.reason.trim().slice(0, 500);
  } catch {
    // Reason is optional
  }

  await repo.artwork.flag(id, reason, session.userId);
  return NextResponse.json({ ok: true });
}
