import { type NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";
import { apiError, isResponse, readJson, requireStudio } from "@/lib/studio/api";
import { UpdateArtistSchema, defined, formatZodError } from "@/lib/studio/validators";

export async function GET(req: NextRequest) {
  const ctx = await requireStudio(req, "studio.view");
  if (isResponse(ctx)) return ctx;
  const artist = await getRepository().artist.findById(ctx.artistId);
  if (!artist) return apiError("NOT_FOUND", 404);
  return NextResponse.json({ ok: true, artist });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireStudio(req, "identity.edit");
  if (isResponse(ctx)) return ctx;
  const json = await readJson(req);
  if (!json.ok) return json.response;
  const parsed = UpdateArtistSchema.safeParse(json.body);
  if (!parsed.success) return apiError("INVALID_INPUT", 400, "Invalid artist profile", formatZodError(parsed.error));

  const repo = getRepository();
  const current = await repo.artist.findById(ctx.artistId);
  if (!current) return apiError("NOT_FOUND", 404);

  const { branding, socialLinks, ...rest } = parsed.data;
  const brandingPatch = branding ? defined(branding) : undefined;
  const artist = await repo.artist.update(ctx.artistId, {
    ...defined(rest),
    ...(brandingPatch ? { branding: { ...current.branding, ...brandingPatch } } : {}),
    // Empty strings clear a link
    ...(socialLinks
      ? {
          socialLinks: Object.fromEntries(
            Object.entries({ ...current.socialLinks, ...socialLinks }).filter(([, v]) => typeof v === "string" && v !== "")
          ) as Record<string, string>,
        }
      : {}),
  });
  await repo.audit.log({
    actorId: ctx.session.userId,
    action: "artist.updated",
    resourceType: "artist",
    resourceId: ctx.artistId,
    metadata: { fields: Object.keys(parsed.data) },
  });
  return NextResponse.json({ ok: true, artist });
}
