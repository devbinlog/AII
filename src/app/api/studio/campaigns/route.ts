import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { apiError, isResponse, notOwned, readJson, requireStudio } from "@/lib/studio/api";
import { CreateCampaignSchema, formatZodError } from "@/lib/studio/validators";

export async function GET(req: NextRequest) {
  const ctx = await requireStudio(req, "studio.view");
  if (isResponse(ctx)) return ctx;
  const { campaigns, total } = await getRepository().campaign.listByArtist(ctx.artistId, { page: 1, pageSize: 200 });
  return NextResponse.json({ ok: true, campaigns, total });
}

export async function POST(req: NextRequest) {
  const ctx = await requireStudio(req, "content.edit");
  if (isResponse(ctx)) return ctx;
  const json = await readJson(req);
  if (!json.ok) return json.response;
  const parsed = CreateCampaignSchema.safeParse(json.body);
  if (!parsed.success) return apiError("INVALID_INPUT", 400, "Invalid campaign", formatZodError(parsed.error));

  const repo = getRepository();
  const { slug, startsAt, endsAt, ...rest } = parsed.data;
  if (notOwned(ctx, await repo.experience.findById(rest.experienceId))) {
    return apiError("INVALID_INPUT", 400, "Experience not found");
  }
  if (await repo.campaign.findBySlug(slug)) return apiError("SLUG_TAKEN", 409, `The address "${slug}" is already in use`);

  const campaign = await repo.campaign.create({
    ...rest,
    slug,
    artistId: ctx.artistId,
    ...(startsAt ? { startsAt } : {}),
    ...(endsAt ? { endsAt } : {}),
  });
  return NextResponse.json({ ok: true, campaign }, { status: 201 });
}
