import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * Public, read-only: the artist's currently published stage version.
 * Drafts are never returned; unpublished or never-published stages are 404.
 */
export async function GET(_req: Request, { params }: RouteContext) {
  const { slug } = await params;
  const repo = getRepository();
  const artist = await repo.artist.findBySlug(slug);
  const version = artist ? await repo.stage.getPublished(artist.id) : null;
  if (!artist || !version) {
    return NextResponse.json({ ok: false, error: { code: "NOT_FOUND" } }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    stage: {
      artist: { slug: artist.slug, name: artist.name },
      version: version.version,
      schemaVersion: version.schemaVersion,
      publishedAt: version.publishedAt,
      items: version.items,
    },
  });
}
