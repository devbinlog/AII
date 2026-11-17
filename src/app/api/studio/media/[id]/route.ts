import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { apiError, isResponse, notOwned, requireStudio } from "@/lib/studio/api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const ctx = await requireStudio(req, "media.delete");
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const repo = getRepository();
  const asset = await repo.media.findById(id);
  if (notOwned(ctx, asset)) return apiError("NOT_FOUND", 404);

  // Refuse to delete images referenced by any of this artist's scenes.
  const { scenes } = await repo.scene.listByArtist(ctx.artistId, { page: 1, pageSize: 500 });
  const usedBy = scenes.filter((s) => s.schema.objects.some((o) => o.data.type === "image" && o.data.assetId === id));
  if (usedBy.length > 0) {
    return apiError("CONFLICT", 409, `Asset is used by ${usedBy.length} scene(s)`, usedBy.map((s) => s.id));
  }
  await repo.media.delete(id);
  return NextResponse.json({ ok: true });
}
