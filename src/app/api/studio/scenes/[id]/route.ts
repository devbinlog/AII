import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { apiError, isResponse, notOwned, readJson, requireStudio } from "@/lib/studio/api";
import { UpdateSceneMetaSchema, defined, formatZodError } from "@/lib/studio/validators";
import { validateSceneSchema } from "@/lib/engine/schema";
import { findBrokenReferences } from "@/lib/studio/publish";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const ctx = await requireStudio(req, "studio.view");
  if (isResponse(ctx)) return ctx;
  const scene = await getRepository().scene.findById((await params).id);
  if (notOwned(ctx, scene)) return apiError("NOT_FOUND", 404);
  return NextResponse.json({ ok: true, scene });
}

/**
 * Save a scene draft. Body: { name?, description?, schema? }.
 * The schema is validated against the WS-04 Scene DSL and for dangling
 * object references. Published experience versions are not affected.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const ctx = await requireStudio(req, "content.edit");
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const repo = getRepository();
  const scene = await repo.scene.findById(id);
  if (notOwned(ctx, scene)) return apiError("NOT_FOUND", 404);

  const json = await readJson(req);
  if (!json.ok) return json.response;
  if (typeof json.body !== "object" || json.body === null) return apiError("INVALID_INPUT", 400, "Body must be an object");
  const { schema, ...metaInput } = json.body as { schema?: unknown };

  const meta = UpdateSceneMetaSchema.safeParse(metaInput);
  if (!meta.success) return apiError("INVALID_INPUT", 400, "Invalid scene details", formatZodError(meta.error));

  let saved = scene;
  if (schema !== undefined) {
    const valid = validateSceneSchema(schema);
    if (!valid.success) return apiError("INVALID_SCHEMA", 400, valid.error, valid.details);
    if (valid.data.sceneId !== id) return apiError("INVALID_SCHEMA", 400, "schema.sceneId must match the scene id");
    const broken = findBrokenReferences(valid.data);
    if (broken.length > 0) return apiError("INVALID_SCHEMA", 400, "Schema references missing objects", broken);
    saved = await repo.scene.save(id, valid.data);
  }
  // Scene name/description are not part of the repository's save(); keep them in sync on the stored scene.
  if (meta.data.name !== undefined || meta.data.description !== undefined) {
    saved = await repo.scene.updateMeta(id, defined(meta.data));
  }
  return NextResponse.json({ ok: true, scene: saved });
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const ctx = await requireStudio(req, "content.edit");
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const repo = getRepository();
  const scene = await repo.scene.findById(id);
  if (notOwned(ctx, scene)) return apiError("NOT_FOUND", 404);
  const { experiences } = await repo.experience.listByArtist(ctx.artistId, { page: 1, pageSize: 200 });
  const usedBy = experiences.filter((e) => e.scenes.some((s) => s.sceneId === id));
  if (usedBy.length > 0) {
    return apiError("CONFLICT", 409, "Scene is used by an experience", usedBy.map((e) => e.id));
  }
  await repo.scene.delete(id);
  return NextResponse.json({ ok: true });
}
