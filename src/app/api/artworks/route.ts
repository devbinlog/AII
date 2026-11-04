import { NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { getSessionTokenFromCookieHeader } from "@/lib/auth/cookie";
import type { FanArtwork } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      campaignId?: unknown;
      experienceVersionId?: unknown;
      title?: unknown;
      customization?: unknown;
      sessionToken?: unknown;
    };

    if (
      typeof body.campaignId !== "string" ||
      typeof body.experienceVersionId !== "string" ||
      typeof body.title !== "string" ||
      !body.customization
    ) {
      return NextResponse.json({ ok: false, error: { code: "INVALID_INPUT", message: "Missing required fields" } }, { status: 400 });
    }

    const cookieHeader = req.headers.get("cookie") ?? "";
    const token = getSessionTokenFromCookieHeader(cookieHeader);
    const repo = getRepository();

    let creatorId: string | undefined;
    if (token) {
      const session = await repo.auth.getSession(token);
      if (session) creatorId = session.userId;
    }

    // Validate campaign exists and is active
    const campaign = await repo.campaign.findById(body.campaignId);
    if (!campaign) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Campaign not found" } }, { status: 404 });
    }
    if (campaign.status !== "active") {
      return NextResponse.json({ ok: false, error: { code: "CAMPAIGN_NOT_ACTIVE", message: "Campaign is not active" } }, { status: 403 });
    }
    if (!campaign.participationPolicy.allowAnonymousCreate && !creatorId) {
      return NextResponse.json({ ok: false, error: { code: "LOGIN_REQUIRED", message: "Login required to create artwork" } }, { status: 401 });
    }

    const createData: Parameters<typeof repo.artwork.create>[0] = {
      campaignId: body.campaignId,
      experienceVersionId: body.experienceVersionId,
      title: body.title,
      customization: body.customization as FanArtwork["customization"],
      ...(creatorId ? { creatorId } : {}),
      ...(typeof body.sessionToken === "string" ? { sessionToken: body.sessionToken } : {}),
    };
    const artwork = await repo.artwork.create(createData);

    return NextResponse.json({ ok: true, artwork }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create artwork";
    return NextResponse.json({ ok: false, error: { code: "ERROR", message } }, { status: 500 });
  }
}
