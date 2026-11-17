import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { apiError, isResponse, notOwned, readJson, requireStudio } from "@/lib/studio/api";
import { UpdateCampaignSchema, defined, formatZodError } from "@/lib/studio/validators";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const ctx = await requireStudio(req, "studio.view");
  if (isResponse(ctx)) return ctx;
  const campaign = await getRepository().campaign.findById((await params).id);
  if (notOwned(ctx, campaign)) return apiError("NOT_FOUND", 404);
  return NextResponse.json({ ok: true, campaign });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const ctx = await requireStudio(req, "content.edit");
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const repo = getRepository();
  const campaign = await repo.campaign.findById(id);
  if (notOwned(ctx, campaign)) return apiError("NOT_FOUND", 404);
  if (campaign.status === "ended" || campaign.status === "archived") {
    return apiError("CONFLICT", 409, `An ${campaign.status} campaign cannot be edited`);
  }

  const json = await readJson(req);
  if (!json.ok) return json.response;
  const parsed = UpdateCampaignSchema.safeParse(json.body);
  if (!parsed.success) return apiError("INVALID_INPUT", 400, "Invalid campaign", formatZodError(parsed.error));
  const { branding, participationPolicy, experienceId, ...rest } = parsed.data;

  if (experienceId !== undefined) {
    const experience = await repo.experience.findById(experienceId);
    if (notOwned(ctx, experience)) return apiError("INVALID_INPUT", 400, "Experience not found");
    if (campaign.status === "active" && !experience.currentVersionId) {
      return apiError("UNPROCESSABLE", 422, "An active campaign needs a published experience");
    }
  }

  const updated = await repo.campaign.update(id, {
    ...defined(rest),
    ...(experienceId !== undefined ? { experienceId } : {}),
    ...(branding ? { branding: defined(branding) } : {}),
    ...(participationPolicy ? { participationPolicy: defined(participationPolicy) } : {}),
  });
  return NextResponse.json({ ok: true, campaign: updated });
}
