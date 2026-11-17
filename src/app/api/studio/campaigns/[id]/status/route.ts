import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { apiError, isResponse, notOwned, readJson, requireStudio } from "@/lib/studio/api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Body: { action: "publish" | "end" }. Publishing makes the campaign public. */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const ctx = await requireStudio(req, "campaign.publish");
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const repo = getRepository();
  const campaign = await repo.campaign.findById(id);
  if (notOwned(ctx, campaign)) return apiError("NOT_FOUND", 404);

  const json = await readJson(req);
  if (!json.ok) return json.response;
  const action = (json.body as { action?: unknown } | null)?.action;

  if (action === "publish") {
    if (campaign.status !== "draft" && campaign.status !== "scheduled") {
      return apiError("CONFLICT", 409, `Cannot publish a campaign that is ${campaign.status}`);
    }
    const experience = await repo.experience.findById(campaign.experienceId);
    if (notOwned(ctx, experience) || !experience.currentVersionId) {
      return apiError("UNPROCESSABLE", 422, "Publish the campaign's experience first");
    }
    const updated = await repo.campaign.publish(id);
    await repo.audit.log({ actorId: ctx.session.userId, action: "campaign.started", resourceType: "campaign", resourceId: id });
    return NextResponse.json({ ok: true, campaign: updated });
  }

  if (action === "end") {
    if (campaign.status !== "active") return apiError("CONFLICT", 409, "Only active campaigns can be ended");
    const updated = await repo.campaign.end(id);
    await repo.audit.log({ actorId: ctx.session.userId, action: "campaign.ended", resourceType: "campaign", resourceId: id });
    return NextResponse.json({ ok: true, campaign: updated });
  }

  return apiError("INVALID_INPUT", 400, 'action must be "publish" or "end"');
}
