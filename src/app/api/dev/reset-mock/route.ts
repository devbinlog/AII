import { NextResponse } from "next/server";

/**
 * Dev/E2E only: reset the in-memory mock store to its fixtures (sessions kept).
 * Unavailable in production and outside MOCK_ONLY mode (middleware also blocks it).
 */
export async function POST() {
  const mode = process.env["NEXT_PUBLIC_DATA_MODE"] ?? "MOCK_ONLY";
  if (process.env.NODE_ENV === "production" || mode !== "MOCK_ONLY") {
    return new NextResponse(null, { status: 404 });
  }
  const { resetMockData } = await import("@/lib/mock/adapters");
  resetMockData({ keepSessions: true });
  return NextResponse.json({ ok: true, reset: "mock-fixtures", keptSessions: true });
}
