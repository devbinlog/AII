import { NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { getSessionTokenFromCookieHeader } from "@/lib/auth/cookie";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const repo = getRepository();
  const artwork = await repo.artwork.findById(id);
  if (!artwork) {
    return NextResponse.json({ ok: false, error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  // For PRIVATE artworks, check ownership
  if (artwork.permission === "private") {
    const cookieHeader = _req.headers.get("cookie") ?? "";
    const token = getSessionTokenFromCookieHeader(cookieHeader);
    if (!token) return NextResponse.json({ ok: false, error: { code: "FORBIDDEN" } }, { status: 403 });
    const session = await repo.auth.getSession(token);
    if (!session || (artwork.creatorId !== null && session.userId !== artwork.creatorId)) {
      return NextResponse.json({ ok: false, error: { code: "FORBIDDEN" } }, { status: 403 });
    }
  }

  // Removed artworks are not accessible
  if (artwork.status === "removed") {
    return NextResponse.json({ ok: false, error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  return NextResponse.json({ ok: true, artwork });
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const cookieHeader = req.headers.get("cookie") ?? "";
  const token = getSessionTokenFromCookieHeader(cookieHeader);
  if (!token) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });

  const repo = getRepository();
  const session = await repo.auth.getSession(token);
  if (!session) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });

  const artwork = await repo.artwork.findById(id);
  if (!artwork) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND" } }, { status: 404 });

  // Only creator or admin can update
  if (artwork.creatorId !== null && artwork.creatorId !== session.userId && session.role !== "platform_admin") {
    return NextResponse.json({ ok: false, error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const body = await req.json() as Record<string, unknown>;
  const allowed = ["title", "imageUrl", "permission", "status", "customization"] as const;
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  const updated = await repo.artwork.update(id, update as Parameters<typeof repo.artwork.update>[1]);
  return NextResponse.json({ ok: true, artwork: updated });
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const cookieHeader = req.headers.get("cookie") ?? "";
  const token = getSessionTokenFromCookieHeader(cookieHeader);
  if (!token) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });

  const repo = getRepository();
  const session = await repo.auth.getSession(token);
  if (!session) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });

  await repo.artwork.delete(id, session.userId);
  return NextResponse.json({ ok: true });
}
