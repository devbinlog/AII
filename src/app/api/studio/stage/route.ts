import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { apiError, isResponse, readJson, requireStudio } from "@/lib/studio/api";
import { defaultStageLayout, parseStageLayout, validateAgainstReference } from "@/lib/stage";

/** The artist's saved stage layout, or the default band layout if none is saved. */
export async function GET(req: NextRequest) {
  const ctx = await requireStudio(req, "studio.view");
  if (isResponse(ctx)) return ctx;
  const repo = getRepository();
  const [saved, publication, versions] = await Promise.all([
    repo.stage.get(ctx.artistId),
    repo.stage.getPublication(ctx.artistId),
    repo.stage.listVersions(ctx.artistId),
  ]);
  return NextResponse.json({
    ok: true,
    layout: saved ?? defaultStageLayout(ctx.artistId),
    saved: saved !== null,
    publication,
    versions: versions.map((v) => ({ id: v.id, version: v.version, publishedAt: v.publishedAt })),
  });
}

/**
 * Save a layout. The server re-checks everything the client enforces:
 * schema, same item set as the default layout, locked amps/drums unmoved,
 * all items inside the stage. artistId always comes from the session.
 */
export async function PUT(req: NextRequest) {
  const ctx = await requireStudio(req, "content.edit");
  if (isResponse(ctx)) return ctx;
  const json = await readJson(req);
  if (!json.ok) return json.response;

  const body = json.body && typeof json.body === "object" ? { ...(json.body as Record<string, unknown>), artistId: ctx.artistId } : json.body;
  const parsed = parseStageLayout(body);
  if (!parsed.ok) return apiError("INVALID_INPUT", 400, parsed.error);

  const problems = validateAgainstReference(parsed.layout, defaultStageLayout(ctx.artistId));
  if (problems.length > 0) return apiError("INVALID_LAYOUT", 422, problems[0], problems);

  const layout = await getRepository().stage.save(parsed.layout);
  return NextResponse.json({ ok: true, layout });
}
