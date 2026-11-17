import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { getSessionTokenFromCookieHeader } from "@/lib/auth/cookie";

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const token = getSessionTokenFromCookieHeader(cookieHeader);
  if (!token) {
    return NextResponse.json({ session: null });
  }
  const repo = getRepository();
  const session = await repo.auth.getSession(token);
  if (!session || new Date(session.expiresAt) < new Date()) {
    return NextResponse.json({ session: null });
  }
  return NextResponse.json({ session });
}
