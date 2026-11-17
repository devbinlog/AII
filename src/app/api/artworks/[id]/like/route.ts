import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { getRequestSession } from "@/lib/auth/request-session";
import { canViewArtwork } from "@/lib/auth/artwork-access";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function handle(req: NextRequest, ctx: RouteContext, action: "like" | "unlike") {
  const { id } = await ctx.params;
  const session = await getRequestSession(req);
  if (!session) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });

  const repo = getRepository();
  const artwork = await repo.artwork.findById(id);
  // Artworks the caller cannot see are reported as not found (no existence leak)
  if (!artwork || !canViewArtwork(artwork, session)) {
    return NextResponse.json({ ok: false, error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  await repo.artwork[action](id, session.userId);
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  return handle(req, ctx, "like");
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  return handle(req, ctx, "unlike");
}
