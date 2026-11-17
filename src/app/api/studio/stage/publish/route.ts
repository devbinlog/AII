import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { apiError, isResponse, requireStudio } from "@/lib/studio/api";
import { defaultStageLayout, parseStageLayout, validateAgainstReference } from "@/lib/stage";

/**
 * Publish the saved draft as a new immutable version (artist admins only).
 * The draft is re-validated on the server; unsaved client changes are never published.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireStudio(req, "stage.publish");
  if (isResponse(ctx)) return ctx;
  const repo = getRepository();

  const draft = await repo.stage.get(ctx.artistId);
  if (!draft) return apiError("UNPROCESSABLE", 422, "Save the stage layout before publishing");
  const parsed = parseStageLayout(draft);
  if (!parsed.ok) return apiError("INVALID_LAYOUT", 422, parsed.error);
  const problems = validateAgainstReference(parsed.layout, defaultStageLayout(ctx.artistId));
  if (problems.length > 0) return apiError("INVALID_LAYOUT", 422, problems[0], problems);

  const version = await repo.stage.publish(ctx.artistId, ctx.session.userId);
  await repo.audit.log({
    actorId: ctx.session.userId,
    action: "owner.operation",
    resourceType: "stage",
    resourceId: version.id,
    metadata: { event: "stage.published", version: version.version },
  });
  return NextResponse.json({ ok: true, version: { id: version.id, version: version.version, publishedAt: version.publishedAt } }, { status: 201 });
}

/** Unpublish: fans can no longer open the stage. Versions are kept. */
export async function DELETE(req: NextRequest) {
  const ctx = await requireStudio(req, "stage.publish");
  if (isResponse(ctx)) return ctx;
  const repo = getRepository();
  const publication = await repo.stage.unpublish(ctx.artistId);
  await repo.audit.log({
    actorId: ctx.session.userId,
    action: "owner.operation",
    resourceType: "stage",
    resourceId: ctx.artistId,
    metadata: { event: "stage.unpublished" },
  });
  return NextResponse.json({ ok: true, publication });
}
