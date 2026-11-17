// @vitest-environment node
/**
 * Contract tests for the Artist Studio API (MOCK_ONLY): authorization by role
 * and artist, input validation, the experience publish contract, frozen
 * published versions, and campaign visibility.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/repository", async () => {
  const { mockRegistry } = await import("@/lib/mock/adapters");
  return { getRepository: () => mockRegistry, resetRepository: () => {} };
});

import { getRepository } from "@/lib/repository";
import * as artistRoute from "@/app/api/studio/artist/route";
import * as releasesRoute from "@/app/api/studio/releases/route";
import * as releaseRoute from "@/app/api/studio/releases/[id]/route";
import * as releasePublishRoute from "@/app/api/studio/releases/[id]/publish/route";
import * as mediaRoute from "@/app/api/studio/media/route";
import * as mediaItemRoute from "@/app/api/studio/media/[id]/route";
import * as scenesRoute from "@/app/api/studio/scenes/route";
import * as sceneRoute from "@/app/api/studio/scenes/[id]/route";
import * as experiencesRoute from "@/app/api/studio/experiences/route";
import * as experienceRoute from "@/app/api/studio/experiences/[id]/route";
import * as experiencePublishRoute from "@/app/api/studio/experiences/[id]/publish/route";
import * as campaignsRoute from "@/app/api/studio/campaigns/route";
import * as campaignRoute from "@/app/api/studio/campaigns/[id]/route";
import * as campaignStatusRoute from "@/app/api/studio/campaigns/[id]/status/route";
import type { Scene, SceneObject, SceneSchema } from "@/types";

const BASE = "http://localhost:3000";
const FREEFALLERS = "art_001";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

function req(path: string, init: { method?: string; token?: string; body?: unknown } = {}) {
  const headers = new Headers();
  if (init.token) headers.set("cookie", `aii_session=${init.token}`);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers,
    ...(init.body !== undefined ? { body: typeof init.body === "string" ? init.body : JSON.stringify(init.body) } : {}),
  });
}

async function json<T = Record<string, unknown>>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function login(email: string): Promise<string> {
  return (await getRepository().auth.signIn(email, "any")).sessionToken;
}

function textObject(id: string, content = "Hello"): SceneObject {
  return {
    id,
    name: "Title",
    transform: { x: 100, y: 100, z: 0, width: 400, height: 80, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    style: { fill: "#ffffff", stroke: null, strokeWidth: 0, fontSize: 48, fontFamily: null, fontWeight: 700, textAlign: "left", borderRadius: 0, blendMode: "normal" },
    data: { type: "text", content },
    visible: true,
    locked: false,
    parentId: null,
    createdAt: "2026-11-17T00:00:00Z",
    updatedAt: "2026-11-17T00:00:00Z",
  };
}

let fan: string;
let admin: string; // artist_admin, Freefallers
let editor: string; // artist_editor, Freefallers
let otherAdmin: string; // artist_admin of a different artist
let otherArtistId: string;

beforeAll(async () => {
  const repo = getRepository();
  fan = await login("fan1@example.com");
  admin = await login("studio@freefallers.com");
  editor = await login("editor@freefallers.com");

  const other = await repo.artist.create({ slug: "contract-other", name: "Other Artist", bio: "", genre: [] }, "test");
  otherArtistId = other.id;
  await repo.auth.createUser({ email: "other-admin@example.com", password: "x", displayName: "Other Admin" });
  const signed = await repo.auth.signIn("other-admin@example.com", "x");
  // Test-only: promote this session to artist_admin of the other artist.
  signed.session.role = "artist_admin";
  signed.session.artistId = otherArtistId;
  otherAdmin = signed.sessionToken;
});

async function createScene(token: string, name = "Contract Scene"): Promise<Scene> {
  const res = await scenesRoute.POST(req("/api/studio/scenes", { method: "POST", token, body: { name } }));
  expect(res.status).toBe(201);
  return (await json<{ scene: Scene }>(res)).scene;
}

async function saveSchema(token: string, scene: Scene, schema: SceneSchema) {
  return sceneRoute.PUT(req(`/api/studio/scenes/${scene.id}`, { method: "PUT", token, body: { schema } }), ctx(scene.id));
}

describe("Studio access", () => {
  it("401 anonymous, 403 fan", async () => {
    expect((await artistRoute.GET(req("/api/studio/artist"))).status).toBe(401);
    expect((await artistRoute.GET(req("/api/studio/artist", { token: fan }))).status).toBe(403);
  });

  it("artist roles are pinned to their own artist even if artistId is supplied", async () => {
    const res = await artistRoute.GET(req(`/api/studio/artist?artistId=${otherArtistId}`, { token: admin }));
    expect(res.status).toBe(200);
    expect((await json<{ artist: { id: string } }>(res)).artist.id).toBe(FREEFALLERS);
  });
});

describe("Identity Editor", () => {
  it("editor cannot edit identity", async () => {
    expect((await artistRoute.PATCH(req("/api/studio/artist", { method: "PATCH", token: editor, body: { bio: "x" } }))).status).toBe(403);
  });

  it("admin edit validates and strips server-owned fields", async () => {
    const bad = await artistRoute.PATCH(req("/api/studio/artist", { method: "PATCH", token: admin, body: { branding: { primaryColor: "red" } } }));
    expect(bad.status).toBe(400);
    const res = await artistRoute.PATCH(
      req("/api/studio/artist", { method: "PATCH", token: admin, body: { bio: "Updated bio", followerCount: 999999, isVerified: false, socialLinks: { website: "https://freefallers.example" } } })
    );
    expect(res.status).toBe(200);
    const { artist } = await json<{ artist: { bio: string; followerCount: number; isVerified: boolean; socialLinks: Record<string, string> } }>(res);
    expect(artist.bio).toBe("Updated bio");
    expect(artist.followerCount).not.toBe(999999);
    expect(artist.isVerified).toBe(true);
    expect(artist.socialLinks.website).toBe("https://freefallers.example");
  });

  it("rejects non-https social links", async () => {
    const res = await artistRoute.PATCH(req("/api/studio/artist", { method: "PATCH", token: admin, body: { socialLinks: { website: "javascript:alert(1)" } } }));
    expect(res.status).toBe(400);
  });
});

describe("Release Manager", () => {
  it("editor creates a draft; publish needs admin and at least one track", async () => {
    const created = await releasesRoute.POST(req("/api/studio/releases", { method: "POST", token: editor, body: { type: "single", title: "New Single", releaseDate: "2026-12-01" } }));
    expect(created.status).toBe(201);
    const { release } = await json<{ release: { id: string; status: string; artistId: string } }>(created);
    expect(release.status).toBe("draft");
    expect(release.artistId).toBe(FREEFALLERS);

    expect((await releasePublishRoute.POST(req(`/api/studio/releases/${release.id}/publish`, { method: "POST", token: editor }), ctx(release.id))).status).toBe(403);
    expect((await releasePublishRoute.POST(req(`/api/studio/releases/${release.id}/publish`, { method: "POST", token: admin }), ctx(release.id))).status).toBe(422);

    const patched = await releaseRoute.PATCH(req(`/api/studio/releases/${release.id}`, { method: "PATCH", token: editor, body: { tracks: [{ title: "Track 1", durationMs: 180000 }] } }), ctx(release.id));
    expect(patched.status).toBe(200);
    const published = await releasePublishRoute.POST(req(`/api/studio/releases/${release.id}/publish`, { method: "POST", token: admin }), ctx(release.id));
    expect(published.status).toBe(200);
    expect((await json<{ release: { status: string } }>(published)).release.status).toBe("released");
    // Released releases cannot be deleted
    expect((await releaseRoute.DELETE(req(`/api/studio/releases/${release.id}`, { method: "DELETE", token: admin }), ctx(release.id))).status).toBe(409);
  });

  it("another artist gets 404 for Freefallers releases", async () => {
    expect((await releaseRoute.GET(req("/api/studio/releases/rel_001", { token: otherAdmin }), ctx("rel_001"))).status).toBe(404);
    expect((await releaseRoute.PATCH(req("/api/studio/releases/rel_001", { method: "PATCH", token: otherAdmin, body: { title: "pwn" } }), ctx("rel_001"))).status).toBe(404);
  });
});

describe("Media Manager", () => {
  const good = { type: "image", filename: "cover.png", mimeType: "image/png", sizeBytes: 1024 };

  it("validates type, mime, filename and preview", async () => {
    const post = (body: unknown) => mediaRoute.POST(req("/api/studio/media", { method: "POST", token: editor, body }));
    expect((await post({ ...good, mimeType: "application/x-msdownload" })).status).toBe(400);
    expect((await post({ ...good, filename: "../../etc/passwd" })).status).toBe(400);
    expect((await post({ ...good, type: "audio", mimeType: "image/png" })).status).toBe(400);
    expect((await post({ ...good, previewDataUrl: "data:text/html;base64,PHNjcmlwdD4=" })).status).toBe(400);
    expect((await post({ type: "audio", filename: "a.mp3", mimeType: "audio/mpeg", sizeBytes: 10, previewDataUrl: "data:image/png;base64,AAAA" })).status).toBe(400);
    expect((await post(good)).status).toBe(201);
  });

  it("only admins delete; other artists get 404", async () => {
    const res = await mediaRoute.POST(req("/api/studio/media", { method: "POST", token: editor, body: good }));
    const { asset } = await json<{ asset: { id: string } }>(res);
    expect((await mediaItemRoute.DELETE(req(`/api/studio/media/${asset.id}`, { method: "DELETE", token: editor }), ctx(asset.id))).status).toBe(403);
    expect((await mediaItemRoute.DELETE(req(`/api/studio/media/${asset.id}`, { method: "DELETE", token: otherAdmin }), ctx(asset.id))).status).toBe(404);
    expect((await mediaItemRoute.DELETE(req(`/api/studio/media/${asset.id}`, { method: "DELETE", token: admin }), ctx(asset.id))).status).toBe(200);
  });
});

describe("Scene Editor save", () => {
  it("validates schema, sceneId and object references", async () => {
    const scene = await createScene(editor);
    const valid: SceneSchema = { ...scene.schema, objects: [textObject("o1")] };

    expect((await saveSchema(editor, scene, { ...valid, canvasWidth: -1 })).status).toBe(400);
    expect((await saveSchema(editor, scene, { ...valid, sceneId: "scn_other" })).status).toBe(400);
    const dangling: SceneSchema = {
      ...valid,
      interactions: [{ id: "i1", objectId: "missing", input: "audio_bass", output: "opacity", inputMin: 0, inputMax: 1, outputMin: 0, outputMax: 1, easing: "linear", smoothing: 0.5 }],
    };
    expect((await saveSchema(editor, scene, dangling)).status).toBe(400);
    expect((await saveSchema(editor, scene, valid)).status).toBe(200);
  });

  it("other artist cannot read or save", async () => {
    const scene = await createScene(admin);
    expect((await sceneRoute.GET(req(`/api/studio/scenes/${scene.id}`, { token: otherAdmin }), ctx(scene.id))).status).toBe(404);
    expect((await saveSchema(otherAdmin, scene, scene.schema)).status).toBe(404);
  });
});

describe("Experience publish contract and frozen versions", () => {
  it("blocks invalid publishes, freezes the snapshot, and versions increment", async () => {
    const created = await experiencesRoute.POST(req("/api/studio/experiences", { method: "POST", token: editor, body: { title: "Studio Experience" } }));
    expect(created.status).toBe(201);
    const { experience } = await json<{ experience: { id: string } }>(created);
    const publish = (token: string) => experiencePublishRoute.POST(req(`/api/studio/experiences/${experience.id}/publish`, { method: "POST", token }), ctx(experience.id));

    // No scenes
    expect((await publish(admin)).status).toBe(422);

    // Empty scene
    const scene = await createScene(editor, "Publish Scene");
    const setScenes = await experienceRoute.PATCH(
      req(`/api/studio/experiences/${experience.id}`, { method: "PATCH", token: editor, body: { scenes: [{ sceneId: scene.id, order: 0, transitionType: "fade", transitionDuration: 500 }] } }),
      ctx(experience.id)
    );
    expect(setScenes.status).toBe(200);
    const emptyRes = await publish(admin);
    expect(emptyRes.status).toBe(422);
    expect(await json(emptyRes)).toMatchObject({ error: { code: "PUBLISH_BLOCKED" } });

    // Editable parameter pointing to a missing object
    await saveSchema(editor, scene, { ...scene.schema, objects: [textObject("t1", "Version One")] });
    const badParam = await experienceRoute.PATCH(
      req(`/api/studio/experiences/${experience.id}`, {
        method: "PATCH",
        token: editor,
        body: { editableParameters: [{ id: "p1", sceneId: scene.id, objectId: "nope", property: "data.content", label: "Title", type: "text", defaultValue: "x" }] },
      }),
      ctx(experience.id)
    );
    expect(badParam.status).toBe(200);
    expect((await publish(admin)).status).toBe(422);
    await experienceRoute.PATCH(
      req(`/api/studio/experiences/${experience.id}`, {
        method: "PATCH",
        token: editor,
        body: { editableParameters: [{ id: "p1", sceneId: scene.id, objectId: "t1", property: "data.content", label: "Title", type: "text", defaultValue: "Version One" }] },
      }),
      ctx(experience.id)
    );

    // Editors cannot publish
    expect((await publish(editor)).status).toBe(403);

    const first = await publish(admin);
    expect(first.status).toBe(201);
    const v1 = (await json<{ version: { id: string; version: string } }>(first)).version;
    expect(v1.version).toBe("1.0.0");

    // Editing the scene after publishing must not change the published version
    await saveSchema(editor, scene, { ...scene.schema, objects: [textObject("t1", "Version Two")] });
    const frozen = await getRepository().experience.findVersionById(v1.id);
    const frozenObj = frozen?.snapshot.sceneSchemas[scene.id]?.objects[0];
    expect(frozenObj?.data).toEqual({ type: "text", content: "Version One" });
    // Fan parameters are frozen with the version too
    expect(frozen?.snapshot.editableParameters?.map((p) => p.label)).toEqual(["Title"]);
    await experienceRoute.PATCH(
      req(`/api/studio/experiences/${experience.id}`, {
        method: "PATCH",
        token: editor,
        body: { editableParameters: [{ id: "p1", sceneId: scene.id, objectId: "t1", property: "data.content", label: "Renamed", type: "text", defaultValue: "x" }] },
      }),
      ctx(experience.id)
    );
    const stillFrozen = await getRepository().experience.findVersionById(v1.id);
    expect(stillFrozen?.snapshot.editableParameters?.map((p) => p.label)).toEqual(["Title"]);

    const second = await publish(admin);
    const v2 = (await json<{ version: { id: string; version: string } }>(second)).version;
    expect(v2.version).toBe("2.0.0");
    const latest = await getRepository().experience.findVersionById(v2.id);
    expect(latest?.snapshot.sceneSchemas[scene.id]?.objects[0]?.data).toEqual({ type: "text", content: "Version Two" });
    expect((await getRepository().experience.findById(experience.id))?.currentVersionId).toBe(v2.id);
  });

  it("experience cannot include another artist's scene", async () => {
    const created = await experiencesRoute.POST(req("/api/studio/experiences", { method: "POST", token: otherAdmin, body: { title: "Other" } }));
    const { experience } = await json<{ experience: { id: string } }>(created);
    const res = await experienceRoute.PATCH(
      req(`/api/studio/experiences/${experience.id}`, { method: "PATCH", token: otherAdmin, body: { scenes: [{ sceneId: "scn_001", order: 0, transitionType: "cut", transitionDuration: 0 }] } }),
      ctx(experience.id)
    );
    expect(res.status).toBe(400);
  });
});

describe("Campaign Builder", () => {
  it("unique slug, draft hidden from public listing, publish requires published experience", async () => {
    const repo = getRepository();
    const draftExp = await repo.experience.create({ artistId: FREEFALLERS, title: "Unpublished", description: "" });
    const base = { title: "Studio Campaign", description: "", experienceId: draftExp.id };

    expect((await campaignsRoute.POST(req("/api/studio/campaigns", { method: "POST", token: editor, body: { ...base, slug: "moonwave-fan-artwork" } }))).status).toBe(409);
    expect((await campaignsRoute.POST(req("/api/studio/campaigns", { method: "POST", token: editor, body: { ...base, slug: "Bad Slug!" } }))).status).toBe(400);
    expect((await campaignsRoute.POST(req("/api/studio/campaigns", { method: "POST", token: otherAdmin, body: { ...base, slug: "other-uses-ff-exp" } }))).status).toBe(400);

    const created = await campaignsRoute.POST(req("/api/studio/campaigns", { method: "POST", token: editor, body: { ...base, slug: "studio-contract-campaign" } }));
    expect(created.status).toBe(201);
    const { campaign } = await json<{ campaign: { id: string; slug: string; status: string } }>(created);
    expect(campaign.status).toBe("draft");

    const listed = await repo.campaign.listPublic({ page: 1, pageSize: 100 });
    expect(listed.campaigns.some((c) => c.id === campaign.id)).toBe(false);

    const status = (token: string, action: string) =>
      campaignStatusRoute.POST(req(`/api/studio/campaigns/${campaign.id}/status`, { method: "POST", token, body: { action } }), ctx(campaign.id));
    expect((await status(editor, "publish")).status).toBe(403);
    expect((await status(admin, "publish")).status).toBe(422);
    expect((await status(otherAdmin, "publish")).status).toBe(404);

    // Point it at the published fixture experience, then publish
    expect((await campaignRoute.PATCH(req(`/api/studio/campaigns/${campaign.id}`, { method: "PATCH", token: editor, body: { experienceId: "exp_001" } }), ctx(campaign.id))).status).toBe(200);
    const live = await status(admin, "publish");
    expect(live.status).toBe(200);
    expect((await json<{ campaign: { status: string } }>(live)).campaign.status).toBe("active");
    expect((await repo.campaign.listPublic({ page: 1, pageSize: 100 })).campaigns.some((c) => c.id === campaign.id)).toBe(true);

    expect((await status(admin, "bogus")).status).toBe(400);
    expect((await status(admin, "end")).status).toBe(200);
    expect((await campaignRoute.PATCH(req(`/api/studio/campaigns/${campaign.id}`, { method: "PATCH", token: admin, body: { title: "x" } }), ctx(campaign.id))).status).toBe(409);
  });
});
