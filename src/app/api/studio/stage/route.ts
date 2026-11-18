import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { apiError, isResponse, readJson, requireStudio } from "@/lib/studio/api";
import { CURRENT_BACKLINE, backlineOf, defaultStageLayout, normalizeStageLayout, parseStageLayout, referenceFor, validateAgainstReference } from "@/lib/stage";

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
    // Read-only: a stored draft comes back on its own backline, coordinates untouched.
    layout: saved ? normalizeStageLayout(saved, referenceFor(saved, ctx.artistId)) : defaultStageLayout(ctx.artistId),
    saved: saved !== null,
    backline: { version: saved ? backlineOf(saved) : CURRENT_BACKLINE, current: CURRENT_BACKLINE },
    publication,
    versions: versions.map((v) => ({ id: v.id, version: v.version, publishedAt: v.publishedAt })),
  });
}

/**
 * Save a layout. The server re-checks everything the client enforces:
 * schema, the default item set minus benched lineup roles, locked amps/drums unmoved,
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

  // Validate against the candidate's own backline; never allow going back to an older one.
  const stored = await getRepository().stage.get(ctx.artistId);
  const floor = stored ? backlineOf(stored) : CURRENT_BACKLINE;
  if (backlineOf(parsed.layout) < floor) {
    return apiError("INVALID_LAYOUT", 422, "This stage already uses a newer backline", [`backline v${backlineOf(parsed.layout)} is older than v${floor}`]);
  }
  const reference = referenceFor(parsed.layout, ctx.artistId);
  const candidate = normalizeStageLayout(parsed.layout, reference);
  const problems = validateAgainstReference(candidate, reference);
  if (problems.length > 0) return apiError("INVALID_LAYOUT", 422, problems[0], problems);

  const layout = await getRepository().stage.save(candidate);
  return NextResponse.json({ ok: true, layout });
}
