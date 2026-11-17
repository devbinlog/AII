import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { setSessionCookie } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: unknown; password?: unknown };
    const email = typeof body.email === "string" ? body.email : null;
    const password = typeof body.password === "string" ? body.password : null;

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: { code: "INVALID_INPUT", message: "Email and password required" } }, { status: 400 });
    }

    const repo = getRepository();
    const { user, sessionToken } = await repo.auth.signIn(email, password);

    await setSessionCookie(sessionToken);

    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Login failed";
    const status = message === "INVALID_CREDENTIALS" ? 401 : 500;
    return NextResponse.json({ ok: false, error: { code: message, message } }, { status });
  }
}
