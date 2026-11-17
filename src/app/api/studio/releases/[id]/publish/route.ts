import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { apiError, isResponse, notOwned, requireStudio } from "@/lib/studio/api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const ctx = await requireStudio(req, "release.publish");
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const repo = getRepository();
  const release = await repo.release.findById(id);
  if (notOwned(ctx, release)) return apiError("NOT_FOUND", 404);
  if (release.tracks.length === 0) return apiError("UNPROCESSABLE", 422, "Add at least one track before publishing");

  const published = await repo.release.publish(id);
  await repo.audit.log({
    actorId: ctx.session.userId,
    action: "release.published",
    resourceType: "release",
    resourceId: id,
  });
  return NextResponse.json({ ok: true, release: published });
}
