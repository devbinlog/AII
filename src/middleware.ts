import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Block /dev/* pages and /api/dev/* endpoints in production.
 * The playground pages have a server-side notFound() guard too (defense in depth).
 */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/dev") || request.nextUrl.pathname.startsWith("/api/dev")) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(null, { status: 404 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dev/:path*", "/api/dev/:path*"],
};
