import { NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { getSessionTokenFromCookieHeader } from "@/lib/auth/cookie";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const cookieHeader = req.headers.get("cookie") ?? "";
  const token = getSessionTokenFromCookieHeader(cookieHeader);
  if (!token) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });

  const repo = getRepository();
  const session = await repo.auth.getSession(token);
  if (!session) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });

  await repo.artwork.like(id, session.userId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const cookieHeader = req.headers.get("cookie") ?? "";
  const token = getSessionTokenFromCookieHeader(cookieHeader);
  if (!token) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });

  const repo = getRepository();
  const session = await repo.auth.getSession(token);
  if (!session) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });

  await repo.artwork.unlike(id, session.userId);
  return NextResponse.json({ ok: true });
}
