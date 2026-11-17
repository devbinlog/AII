import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { apiError, isResponse, readJson, requireStudio } from "@/lib/studio/api";
import { CreateSceneSchema, formatZodError } from "@/lib/studio/validators";

export async function GET(req: NextRequest) {
  const ctx = await requireStudio(req, "studio.view");
  if (isResponse(ctx)) return ctx;
  const { scenes, total } = await getRepository().scene.listByArtist(ctx.artistId, { page: 1, pageSize: 200 });
  return NextResponse.json({ ok: true, scenes, total });
}

export async function POST(req: NextRequest) {
  const ctx = await requireStudio(req, "content.edit");
  if (isResponse(ctx)) return ctx;
  const json = await readJson(req);
  if (!json.ok) return json.response;
  const parsed = CreateSceneSchema.safeParse(json.body);
  if (!parsed.success) return apiError("INVALID_INPUT", 400, "Invalid scene", formatZodError(parsed.error));
  const { description, ...rest } = parsed.data;
  const scene = await getRepository().scene.create(
    { ...rest, ...(description !== undefined ? { description } : {}), artistId: ctx.artistId },
    ctx.session.userId
  );
  return NextResponse.json({ ok: true, scene }, { status: 201 });
}
