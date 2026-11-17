import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { apiError, isResponse, notOwned, readJson, requireStudio } from "@/lib/studio/api";
import { CreateExperienceSchema, formatZodError } from "@/lib/studio/validators";

export async function GET(req: NextRequest) {
  const ctx = await requireStudio(req, "studio.view");
  if (isResponse(ctx)) return ctx;
  const { experiences, total } = await getRepository().experience.listByArtist(ctx.artistId, { page: 1, pageSize: 200 });
  return NextResponse.json({ ok: true, experiences, total });
}

export async function POST(req: NextRequest) {
  const ctx = await requireStudio(req, "content.edit");
  if (isResponse(ctx)) return ctx;
  const json = await readJson(req);
  if (!json.ok) return json.response;
  const parsed = CreateExperienceSchema.safeParse(json.body);
  if (!parsed.success) return apiError("INVALID_INPUT", 400, "Invalid experience", formatZodError(parsed.error));

  const repo = getRepository();
  const { releaseId, ...rest } = parsed.data;
  if (releaseId !== undefined && notOwned(ctx, await repo.release.findById(releaseId))) {
    return apiError("INVALID_INPUT", 400, "Release not found");
  }
  const experience = await repo.experience.create({
    ...rest,
    artistId: ctx.artistId,
    ...(releaseId !== undefined ? { releaseId } : {}),
  });
  return NextResponse.json({ ok: true, experience }, { status: 201 });
}
