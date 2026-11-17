import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { apiError, isResponse, readJson, requireStudio } from "@/lib/studio/api";
import { CreateMediaSchema, defined, formatZodError } from "@/lib/studio/validators";

export async function GET(req: NextRequest) {
  const ctx = await requireStudio(req, "studio.view");
  if (isResponse(ctx)) return ctx;
  const { assets, total } = await getRepository().media.listByArtist(ctx.artistId, { page: 1, pageSize: 200 });
  return NextResponse.json({ ok: true, assets, total });
}

/** Mock upload: registers metadata (and an optional inline image preview) in memory only. */
export async function POST(req: NextRequest) {
  const ctx = await requireStudio(req, "content.edit");
  if (isResponse(ctx)) return ctx;
  const json = await readJson(req);
  if (!json.ok) return json.response;
  const parsed = CreateMediaSchema.safeParse(json.body);
  if (!parsed.success) return apiError("INVALID_INPUT", 400, "Invalid media upload", formatZodError(parsed.error));

  const { previewDataUrl, ...meta } = parsed.data;
  const repo = getRepository();
  const { asset } = await repo.media.prepareUpload({
    ...defined(meta),
    type: meta.type,
    filename: meta.filename,
    mimeType: meta.mimeType,
    sizeBytes: meta.sizeBytes,
    artistId: ctx.artistId,
    uploadedBy: ctx.session.userId,
    ...(previewDataUrl ? { previewDataUrl } : {}),
  });
  const confirmed = await repo.media.confirmUpload(asset.id);
  return NextResponse.json({ ok: true, asset: confirmed }, { status: 201 });
}
