import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { apiError, isResponse, notOwned, readJson, requireStudio } from "@/lib/studio/api";
import { UpdateExperienceSchema, defined, formatZodError } from "@/lib/studio/validators";
import type { EditableParameter, ExperienceScene } from "@/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const ctx = await requireStudio(req, "studio.view");
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const repo = getRepository();
  const experience = await repo.experience.findById(id);
  if (notOwned(ctx, experience)) return apiError("NOT_FOUND", 404);
  const versions = await repo.experience.listVersions(id);
  return NextResponse.json({
    ok: true,
    experience,
    versions: versions.map((v) => ({ id: v.id, version: v.version, publishedAt: v.publishedAt, publishedBy: v.publishedBy, sceneCount: v.snapshot.scenes.length })),
  });
}

/** Edit the draft. Published versions stay frozen until the next publish. */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const ctx = await requireStudio(req, "content.edit");
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const repo = getRepository();
  const experience = await repo.experience.findById(id);
  if (notOwned(ctx, experience)) return apiError("NOT_FOUND", 404);

  const json = await readJson(req);
  if (!json.ok) return json.response;
  const parsed = UpdateExperienceSchema.safeParse(json.body);
  if (!parsed.success) return apiError("INVALID_INPUT", 400, "Invalid experience", formatZodError(parsed.error));
  const { scenes, editableParameters, releaseId, ...rest } = parsed.data;

  // Every referenced scene / release must belong to this artist.
  if (scenes) {
    const ids = new Set<string>();
    for (const s of scenes) {
      if (ids.has(s.sceneId)) return apiError("INVALID_INPUT", 400, `Scene ${s.sceneId} is listed twice`);
      ids.add(s.sceneId);
      if (notOwned(ctx, await repo.scene.findById(s.sceneId))) {
        return apiError("INVALID_INPUT", 400, `Scene ${s.sceneId} not found`);
      }
    }
  }
  if (releaseId && notOwned(ctx, await repo.release.findById(releaseId))) {
    return apiError("INVALID_INPUT", 400, "Release not found");
  }

  const updated = await repo.experience.update(id, {
    ...defined(rest),
    ...(releaseId !== undefined ? { releaseId } : {}),
    ...(scenes
      ? { scenes: [...scenes].sort((a, b) => a.order - b.order).map((s, i): ExperienceScene => ({ ...s, order: i })) }
      : {}),
    ...(editableParameters ? { editableParameters: editableParameters.map((p) => defined(p) as EditableParameter) } : {}),
  });
  return NextResponse.json({ ok: true, experience: updated });
}
