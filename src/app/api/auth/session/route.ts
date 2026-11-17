import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { getRequestSession } from "@/lib/auth/request-session";

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req);
  if (!session) {
    return NextResponse.json({ session: null, user: null });
  }
  const user = await getRepository().auth.getUser(session.userId);
  return NextResponse.json({
    session,
    user: user ? { displayName: user.displayName, email: user.email } : null,
  });
}
