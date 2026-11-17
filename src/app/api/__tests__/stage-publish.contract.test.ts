// @vitest-environment node
/** Stage Draft → immutable published version → public read-only API. */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/repository", async () => {
  const { mockRegistry } = await import("@/lib/mock/adapters");
  return { getRepository: () => mockRegistry, resetRepository: () => {} };
});

import { getRepository } from "@/lib/repository";
import * as studioStage from "@/app/api/studio/stage/route";
import * as publishRoute from "@/app/api/studio/stage/publish/route";
import { GET as publicStage } from "@/app/api/artists/[slug]/stage/route";
import { defaultStageLayout, moveItem, type StageItem } from "@/lib/stage";

const BASE = "http://localhost:3000";
const req = (path: string, method: string, token?: string, body?: unknown) => {
  const headers = new Headers();
  if (token) headers.set("cookie", `aii_session=${token}`);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(`${BASE}${path}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
};
const slugCtx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const getPublic = async (slug = "freefallers") => publicStage(new Request(`${BASE}/api/artists/${slug}/stage`), slugCtx(slug));
const publicItems = async (slug = "freefallers") => ((await (await getPublic(slug)).json()) as { stage: { items: StageItem[]; version: number } }).stage;
const pos = (items: StageItem[], id: string) => items.find((i) => i.id === id)!.position;

let admin: string;
let editor: string;
let fan: string;
let otherAdmin: string;

beforeAll(async () => {
  const repo = getRepository();
  admin = (await repo.auth.signIn("studio@freefallers.com", "x")).sessionToken;
  editor = (await repo.auth.signIn("editor@freefallers.com", "x")).sessionToken;
  fan = (await repo.auth.signIn("fan1@example.com", "x")).sessionToken;
  const other = await repo.artist.create({ slug: "stage-other", name: "Stage Other", bio: "", genre: [] }, "test");
  await repo.auth.createUser({ email: "stage-other@example.com", password: "x", displayName: "Other" });
  const signed = await repo.auth.signIn("stage-other@example.com", "x");
  signed.session.role = "artist_admin"; // test-only promotion
  signed.session.artistId = other.id;
  otherAdmin = signed.sessionToken;
});

const save = (token: string, layout: unknown) => studioStage.PUT(req("/api/studio/stage", "PUT", token, layout));
const publish = (token?: string) => publishRoute.POST(req("/api/studio/stage/publish", "POST", token));
const unpublish = (token?: string) => publishRoute.DELETE(req("/api/studio/stage/publish", "DELETE", token));

describe("Stage publish workflow", () => {
  it("D: nothing is public before publishing; drafts never leak", async () => {
    expect((await getPublic()).status).toBe(404);
    expect((await save(editor, moveItem(defaultStageLayout("art_001"), "member-vocal", [1, 0, 2]))).status).toBe(200);
    // A saved draft alone is still not public
    expect((await getPublic()).status).toBe(404);
    expect((await getPublic("no-such-artist")).status).toBe(404);
  });

  it("B/C: only artist admins publish or unpublish", async () => {
    expect((await publish()).status).toBe(401);
    expect((await publish(fan)).status).toBe(403);
    expect((await publish(editor)).status).toBe(403);
    expect((await unpublish(editor)).status).toBe(403);
    expect((await unpublish(fan)).status).toBe(403);
    // Fans cannot edit the draft either
    expect((await save(fan, defaultStageLayout("art_001"))).status).toBe(403);
  });

  it("publishing requires a saved draft", async () => {
    const res = await publish(otherAdmin);
    expect(res.status).toBe(422);
  });

  it("A/E: publish freezes a version; later draft edits do not change it", async () => {
    const first = await publish(admin);
    expect(first.status).toBe(201);
    expect(((await first.json()) as { version: { version: number } }).version.version).toBe(1);

    const v1 = await publicItems();
    expect(v1.version).toBe(1);
    expect(pos(v1.items, "member-vocal")).toEqual([1, 0, 2]);

    // Draft changes after publishing
    expect((await save(editor, moveItem(defaultStageLayout("art_001"), "member-vocal", [-2, 0, 1]))).status).toBe(200);
    expect(pos((await publicItems()).items, "member-vocal")).toEqual([1, 0, 2]);

    // Publishing again creates v2 with the new draft
    expect((await publish(admin)).status).toBe(201);
    const v2 = await publicItems();
    expect(v2.version).toBe(2);
    expect(pos(v2.items, "member-vocal")).toEqual([-2, 0, 1]);

    const studio = (await (await studioStage.GET(req("/api/studio/stage", "GET", admin))).json()) as { versions: { version: number }[]; publication: { visibility: string } };
    expect(studio.versions.map((v) => v.version)).toEqual([2, 1]);
    expect(studio.publication.visibility).toBe("public");
  });

  it("F: unpublishing closes the public stage", async () => {
    expect((await unpublish(admin)).status).toBe(200);
    expect((await getPublic()).status).toBe(404);
    // Re-publish works again
    expect((await publish(admin)).status).toBe(201);
    expect((await getPublic()).status).toBe(200);
  });

  it("another artist's publish only affects their own stage", async () => {
    expect((await save(otherAdmin, defaultStageLayout("ignored"))).status).toBe(200);
    expect((await publish(otherAdmin)).status).toBe(201);
    expect((await publicItems("stage-other")).version).toBe(1);
    expect((await publicItems("freefallers")).version).toBe(3);
    expect((await unpublish(otherAdmin)).status).toBe(200);
    expect((await getPublic("freefallers")).status).toBe(200);
  });

  it("public API is read-only (no write handlers exported)", async () => {
    const mod = await import("@/app/api/artists/[slug]/stage/route");
    expect(Object.keys(mod).sort()).toEqual(["GET"]);
  });
});
