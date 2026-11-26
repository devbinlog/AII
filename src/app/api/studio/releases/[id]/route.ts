import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { apiError, isResponse, notOwned, readJson, requireStudio } from "@/lib/studio/api";
import { UpdateReleaseSchema, defined, formatZodError } from "@/lib/studio/validators";
import type { Track } from "@/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const ctx = await requireStudio(req, "studio.view");
  if (isResponse(ctx)) return ctx;
  const release = await getRepository().release.findById((await params).id);
  if (notOwned(ctx, release)) return apiError("NOT_FOUND", 404);
  return NextResponse.json({ ok: true, release });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const ctx = await requireStudio(req, "content.edit");
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const repo = getRepository();
  const release = await repo.release.findById(id);
  if (notOwned(ctx, release)) return apiError("NOT_FOUND", 404);

  const json = await readJson(req);
  if (!json.ok) return json.response;
  const parsed = UpdateReleaseSchema.safeParse(json.body);
  if (!parsed.success) return apiError("INVALID_INPUT", 400, "Invalid release", formatZodError(parsed.error));

  const { tracks, ...rest } = parsed.data;
  const update = {
    ...defined(rest),
    ...(tracks
      ? {
          tracks: tracks.map(
            (t, i): Track => {
              const existing = release.tracks[i];
              return {
                id: existing?.id ?? `${release.id}_trk_${i + 1}`,
                releaseId: release.id,
                position: i + 1,
                title: t.title,
                durationMs: t.durationMs,
                audioUrl: existing?.audioUrl ?? null,
                previewUrl: existing?.previewUrl ?? null,
                isrc: existing?.isrc ?? null,
              };
            }
          ),
        }
      : {}),
  };
  const updated = await repo.release.update(id, update);
  return NextResponse.json({ ok: true, release: updated });
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const ctx = await requireStudio(req, "content.edit");
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const repo = getRepository();
  const release = await repo.release.findById(id);
  if (notOwned(ctx, release)) return apiError("NOT_FOUND", 404);
  if (release.status !== "draft") return apiError("CONFLICT", 409, "Only draft releases can be deleted");
  // Keep Experience.releaseId links intact: unlink first, then delete.
  const { experiences } = await repo.experience.listByArtist(ctx.artistId, { page: 1, pageSize: 200 });
  const linked = experiences.filter((e) => e.releaseId === id);
  if (linked.length > 0) {
    return apiError("CONFLICT", 409, "Release is linked to an experience", linked.map((e) => e.title));
  }
  await repo.release.delete(id);
  return NextResponse.json({ ok: true });
}
