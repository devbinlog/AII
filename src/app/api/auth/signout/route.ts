import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { getSessionTokenFromCookieHeader } from "@/lib/auth/cookie";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  // Invalidate the server-side session too, so a copied cookie stops working.
  const token = getSessionTokenFromCookieHeader(req.headers.get("cookie") ?? "");
  if (token) await getRepository().auth.signOut(token);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
