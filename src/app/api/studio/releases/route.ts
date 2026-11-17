import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { apiError, isResponse, readJson, requireStudio } from "@/lib/studio/api";
import { CreateReleaseSchema, formatZodError } from "@/lib/studio/validators";

export async function GET(req: NextRequest) {
  const ctx = await requireStudio(req, "studio.view");
  if (isResponse(ctx)) return ctx;
  const { releases, total } = await getRepository().release.listByArtist(ctx.artistId, { page: 1, pageSize: 100 });
  return NextResponse.json({ ok: true, releases, total });
}

export async function POST(req: NextRequest) {
  const ctx = await requireStudio(req, "content.edit");
  if (isResponse(ctx)) return ctx;
  const json = await readJson(req);
  if (!json.ok) return json.response;
  const parsed = CreateReleaseSchema.safeParse(json.body);
  if (!parsed.success) return apiError("INVALID_INPUT", 400, "Invalid release", formatZodError(parsed.error));
  const release = await getRepository().release.create({ ...parsed.data, artistId: ctx.artistId });
  return NextResponse.json({ ok: true, release }, { status: 201 });
}
