import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { apiError, isResponse, notOwned, requireStudio } from "@/lib/studio/api";
import { validateExperienceForPublish } from "@/lib/studio/publish";
import { loadExperienceReadiness } from "@/lib/studio/readiness-loader";
import type { Scene } from "@/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Publish readiness (dry run): the same checks POST enforces, plus whether the
 * saved draft differs from the live version. Read-only; any Studio role may ask.
 * Unsaved client edits are not seen — only what is stored on the server.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const ctx = await requireStudio(req, "studio.view");
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const repo = getRepository();
  const experience = await repo.experience.findById(id);
  if (notOwned(ctx, experience)) return apiError("NOT_FOUND", 404);
  const readiness = await loadExperienceReadiness(repo, experience);
  return NextResponse.json({ ok: true, readiness });
}

/**
 * Freeze the current draft into a new immutable ExperienceVersion.
 * Fans see it immediately through every campaign that uses this experience.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const ctx = await requireStudio(req, "experience.publish");
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const repo = getRepository();
  const experience = await repo.experience.findById(id);
  if (notOwned(ctx, experience)) return apiError("NOT_FOUND", 404);

  const sceneIds = new Set([...experience.scenes.map((s) => s.sceneId), ...experience.editableParameters.map((p) => p.sceneId)]);
  const scenesById = new Map<string, Scene | null>();
  for (const sceneId of sceneIds) scenesById.set(sceneId, await repo.scene.findById(sceneId));

  const issues = validateExperienceForPublish(experience, scenesById);
  if (issues.length > 0) return apiError("PUBLISH_BLOCKED", 422, issues[0]!.message, issues);

  const version = await repo.experience.publish(id, ctx.session.userId);
  await repo.audit.log({
    actorId: ctx.session.userId,
    action: "experience.published",
    resourceType: "experience",
    resourceId: id,
    metadata: { versionId: version.id, version: version.version },
  });
  return NextResponse.json({ ok: true, version: { id: version.id, version: version.version, publishedAt: version.publishedAt } }, { status: 201 });
}
