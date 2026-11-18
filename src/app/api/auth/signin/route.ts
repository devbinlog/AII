import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { setSessionCookie } from "@/lib/auth/session";
import { safeRedirect } from "@/lib/auth/redirect";

/**
 * JSON (fetch from the hydrated login form): returns { ok, user } as before.
 * Form post (the same form submitted before React hydrates — slow networks):
 * sets the session cookie and 303-redirects, so sign-in works without JS.
 * Form posts must come from this origin (login-CSRF guard).
 */
export async function POST(req: NextRequest) {
  const isForm = (req.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded");
  return isForm ? formSignIn(req) : jsonSignIn(req);
}

async function jsonSignIn(req: NextRequest) {
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

async function formSignIn(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) {
    return NextResponse.json({ ok: false, error: { code: "FORBIDDEN", message: "Cross-site sign-in is not allowed" } }, { status: 403 });
  }
  const form = await req.formData();
  const field = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : "";
  };
  const redirectTo = safeRedirect(field("redirect"));
  const back = (error: string) => {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("error", error);
    if (redirectTo !== "/me/artworks") url.searchParams.set("redirect", redirectTo);
    return NextResponse.redirect(url, 303);
  };
  const email = field("email");
  const password = field("password");
  if (!email || !password) return back("missing");
  try {
    const { sessionToken } = await getRepository().auth.signIn(email, password);
    await setSessionCookie(sessionToken);
    return NextResponse.redirect(new URL(redirectTo, req.nextUrl.origin), 303);
  } catch {
    return back("invalid");
  }
}
