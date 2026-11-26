// @vitest-environment node
/**
 * WS-08 contract: server-side publish readiness (GET /api/studio/experiences/:id/publish),
 * draft-vs-live detection, published-version immutability, and the release
 * delete guard that keeps Experience.releaseId links intact. MOCK_ONLY.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/repository", async () => {
  const { mockRegistry } = await import("@/lib/mock/adapters");
  return { getRepository: () => mockRegistry, resetRepository: () => {} };
});

import { getRepository } from "@/lib/repository";
import * as releasesRoute from "@/app/api/studio/releases/route";
import * as releaseRoute from "@/app/api/studio/releases/[id]/route";
import * as scenesRoute from "@/app/api/studio/scenes/route";
import * as sceneRoute from "@/app/api/studio/scenes/[id]/route";
import * as experiencesRoute from "@/app/api/studio/experiences/route";
import * as experienceRoute from "@/app/api/studio/experiences/[id]/route";
import * as publishRoute from "@/app/api/studio/experiences/[id]/publish/route";
import * as campaignsRoute from "@/app/api/studio/campaigns/route";
import * as campaignRoute from "@/app/api/studio/campaigns/[id]/route";
import type { ExperienceReadiness } from "@/lib/studio/readiness";
import type { Scene, SceneObject } from "@/types";

const BASE = "http://localhost:3000";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

function req(path: string, init: { method?: string; token?: string; body?: unknown } = {}) {
  const headers = new Headers();
  if (init.token) headers.set("cookie", `aii_session=${init.token}`);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers,
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
}

const json = async <T>(res: Response) => (await res.json()) as T;
const login = async (email: string) => (await getRepository().auth.signIn(email, "any")).sessionToken;

function textObject(id: string): SceneObject {
  return {
    id,
    name: "Title",
    transform: { x: 100, y: 100, z: 0, width: 400, height: 80, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    style: { fill: "#ffffff", stroke: null, strokeWidth: 0, fontSize: 48, fontFamily: null, fontWeight: 700, textAlign: "left", borderRadius: 0, blendMode: "normal" },
    data: { type: "text", content: "Hello" },
    visible: true,
    locked: false,
    parentId: null,
    createdAt: "2026-11-26T00:00:00Z",
    updatedAt: "2026-11-26T00:00:00Z",
  };
}

let fan: string;
let admin: string;
let editor: string;
let otherAdmin: string;
let otherArtistId: string;

beforeAll(async () => {
  const repo = getRepository();
  fan = await login("fan1@example.com");
  admin = await login("studio@freefallers.com");
  editor = await login("editor@freefallers.com");
  const other = await repo.artist.create({ slug: "readiness-other", name: "Other", bio: "", genre: [] }, "test");
  otherArtistId = other.id;
  await repo.auth.createUser({ email: "readiness-other@example.com", password: "x", displayName: "Other Admin" });
  const signed = await repo.auth.signIn("readiness-other@example.com", "x");
  signed.session.role = "artist_admin";
  signed.session.artistId = other.id;
  otherAdmin = signed.sessionToken;
});

async function sceneWithObject(token: string): Promise<Scene> {
  const created = await json<{ scene: Scene }>(await scenesRoute.POST(req("/api/studio/scenes", { method: "POST", token, body: { name: "Readiness scene" } })));
  const schema = { ...created.scene.schema, objects: [textObject("obj_title")] };
  const res = await sceneRoute.PUT(req(`/api/studio/scenes/${created.scene.id}`, { method: "PUT", token, body: { schema } }), ctx(created.scene.id));
  expect(res.status).toBe(200);
  return (await json<{ scene: Scene }>(res)).scene;
}

async function newExperience(token: string, body: Record<string, unknown> = {}): Promise<string> {
  const res = await experiencesRoute.POST(req("/api/studio/experiences", { method: "POST", token, body: { title: "Readiness exp", ...body } }));
  expect(res.status).toBe(201);
  return (await json<{ experience: { id: string } }>(res)).experience.id;
}

const readiness = async (id: string, token?: string) => {
  const res = await publishRoute.GET(req(`/api/studio/experiences/${id}/publish`, token ? { token } : {}), ctx(id));
  return { status: res.status, body: res.status === 200 ? (await json<{ readiness: ExperienceReadiness }>(res)).readiness : null };
};

describe("GET /api/studio/experiences/:id/publish — readiness", () => {
  it("401 anonymous, 403 fan, 404 for another artist (no existence leak)", async () => {
    const id = await newExperience(admin);
    expect((await readiness(id)).status).toBe(401);
    expect((await readiness(id, fan)).status).toBe(403);
    expect((await readiness(id, otherAdmin)).status).toBe(404);
    expect((await readiness("exp_does_not_exist", admin)).status).toBe(404);
  });

  it("editors may read readiness even though they cannot publish", async () => {
    const id = await newExperience(admin);
    expect((await readiness(id, editor)).status).toBe(200);
    const post = await publishRoute.POST(req(`/api/studio/experiences/${id}/publish`, { method: "POST", token: editor }), ctx(id));
    expect(post.status).toBe(403);
  });

  it("matches what POST enforces: an empty experience is blocked with the same issue", async () => {
    const id = await newExperience(admin);
    const r = (await readiness(id, admin)).body!;
    expect(r.ready).toBe(false);
    expect(r.issues[0]?.code).toBe("NO_SCENES");
    expect(r.liveVersion).toBeNull();
    const post = await publishRoute.POST(req(`/api/studio/experiences/${id}/publish`, { method: "POST", token: admin }), ctx(id));
    expect(post.status).toBe(422);
    expect((await json<{ error: { details: { code: string }[] } }>(post)).error.details[0]?.code).toBe("NO_SCENES");
  });

  it("is read-only: asking never creates a version", async () => {
    const id = await newExperience(admin);
    await readiness(id, admin);
    await readiness(id, admin);
    expect(await getRepository().experience.listVersions(id)).toHaveLength(0);
  });

  it("tracks draft vs live across publish, scene edits, and republish; old versions stay frozen", async () => {
    const scene = await sceneWithObject(admin);
    const id = await newExperience(admin);
    const patch = await experienceRoute.PATCH(
      req(`/api/studio/experiences/${id}`, { method: "PATCH", token: admin, body: { scenes: [{ sceneId: scene.id, order: 0, transitionType: "fade", transitionDuration: 600 }] } }),
      ctx(id)
    );
    expect(patch.status).toBe(200);

    let r = (await readiness(id, admin)).body!;
    expect(r.ready).toBe(true);
    expect(r.hasUnpublishedChanges).toBe(true);
    expect(r.nextVersion).toBe("1.0.0");

    expect((await publishRoute.POST(req(`/api/studio/experiences/${id}/publish`, { method: "POST", token: admin }), ctx(id))).status).toBe(201);
    r = (await readiness(id, admin)).body!;
    expect(r.liveVersion?.version).toBe("1.0.0");
    expect(r.hasUnpublishedChanges).toBe(false);
    expect(r.nextVersion).toBe("2.0.0");

    // Edit the scene after publishing: the draft now differs, v1 does not change.
    const edited = { ...scene.schema, objects: [{ ...textObject("obj_title"), data: { type: "text" as const, content: "Changed" } }] };
    expect((await sceneRoute.PUT(req(`/api/studio/scenes/${scene.id}`, { method: "PUT", token: admin, body: { schema: edited } }), ctx(scene.id))).status).toBe(200);
    r = (await readiness(id, admin)).body!;
    expect(r.hasUnpublishedChanges).toBe(true);
    const v1 = (await getRepository().experience.listVersions(id))[0]!;
    const frozen = v1.snapshot.sceneSchemas[scene.id]!.objects[0]!.data;
    expect(frozen).toEqual({ type: "text", content: "Hello" });

    expect((await publishRoute.POST(req(`/api/studio/experiences/${id}/publish`, { method: "POST", token: admin }), ctx(id))).status).toBe(201);
    const versions = await getRepository().experience.listVersions(id);
    expect(versions.map((v) => v.version).sort()).toEqual(["1.0.0", "2.0.0"]);
    expect(versions.find((v) => v.version === "1.0.0")!.snapshot.sceneSchemas[scene.id]!.objects[0]!.data).toEqual({ type: "text", content: "Hello" });
    expect((await readiness(id, admin)).body!.hasUnpublishedChanges).toBe(false);
  });

  it("reports the linked release only when it is the artist's own", async () => {
    const rel = await json<{ release: { id: string } }>(
      await releasesRoute.POST(req("/api/studio/releases", { method: "POST", token: admin, body: { title: "Readiness single", type: "single", releaseDate: "2026-12-01" } }))
    );
    const id = await newExperience(admin, { releaseId: rel.release.id });
    expect((await readiness(id, admin)).body!.release?.id).toBe(rel.release.id);
  });
});

describe("DELETE /api/studio/releases/:id keeps experience links intact", () => {
  it("409 while an experience links the draft release; deletable after unlinking", async () => {
    const created = await releasesRoute.POST(req("/api/studio/releases", { method: "POST", token: admin, body: { title: "Linked draft", type: "single", releaseDate: "2026-12-01" } }));
    expect(created.status).toBe(201);
    const releaseId = (await json<{ release: { id: string } }>(created)).release.id;
    const expId = await newExperience(admin, { releaseId });

    const blocked = await releaseRoute.DELETE(req(`/api/studio/releases/${releaseId}`, { method: "DELETE", token: admin }), ctx(releaseId));
    expect(blocked.status).toBe(409);
    expect(await getRepository().release.findById(releaseId)).not.toBeNull();

    const unlink = await experienceRoute.PATCH(req(`/api/studio/experiences/${expId}`, { method: "PATCH", token: admin, body: { releaseId: null } }), ctx(expId));
    expect(unlink.status).toBe(200);
    const ok = await releaseRoute.DELETE(req(`/api/studio/releases/${releaseId}`, { method: "DELETE", token: admin }), ctx(releaseId));
    expect(ok.status).toBe(200);
    expect(await getRepository().release.findById(releaseId)).toBeNull();
  });

  it("another artist cannot delete it (404)", async () => {
    const created = await releasesRoute.POST(req("/api/studio/releases", { method: "POST", token: admin, body: { title: "Mine", type: "single", releaseDate: "2026-12-01" } }));
    const releaseId = (await json<{ release: { id: string } }>(created)).release.id;
    expect((await releaseRoute.DELETE(req(`/api/studio/releases/${releaseId}`, { method: "DELETE", token: otherAdmin }), ctx(releaseId))).status).toBe(404);
  });
});

describe("Cross-artist isolation (server-side, not UI filtering)", () => {
  const FF_RELEASE = "rel_001";
  const FF_EXPERIENCE = "exp_001";
  const FF_CAMPAIGN = "cmp_001";

  it("cannot link another artist's release on create or update", async () => {
    const created = await experiencesRoute.POST(req("/api/studio/experiences", { method: "POST", token: otherAdmin, body: { title: "X", releaseId: FF_RELEASE } }));
    expect(created.status).toBe(400);
    const own = await newExperience(otherAdmin);
    const patched = await experienceRoute.PATCH(req(`/api/studio/experiences/${own}`, { method: "PATCH", token: otherAdmin, body: { releaseId: FF_RELEASE } }), ctx(own));
    expect(patched.status).toBe(400);
    expect((await getRepository().experience.findById(own))!.releaseId).toBeNull();
  });

  it("cannot read or edit another artist's campaign, nor point its own campaign at a foreign experience", async () => {
    expect((await campaignRoute.GET(req(`/api/studio/campaigns/${FF_CAMPAIGN}`, { token: otherAdmin }), ctx(FF_CAMPAIGN))).status).toBe(404);
    expect((await campaignRoute.PATCH(req(`/api/studio/campaigns/${FF_CAMPAIGN}`, { method: "PATCH", token: otherAdmin, body: { title: "pwn" } }), ctx(FF_CAMPAIGN))).status).toBe(404);
    const list = await json<{ campaigns: { artistId: string }[] }>(await campaignsRoute.GET(req("/api/studio/campaigns", { token: otherAdmin })));
    expect(list.campaigns.every((c) => c.artistId === otherArtistId)).toBe(true);

    const own = await newExperience(otherAdmin);
    const cmp = await campaignsRoute.POST(req("/api/studio/campaigns", { method: "POST", token: otherAdmin, body: { title: "Own", slug: `own-${Date.now()}`, experienceId: own } }));
    expect(cmp.status).toBe(201);
    const cmpId = (await json<{ campaign: { id: string } }>(cmp)).campaign.id;
    const repoint = await campaignRoute.PATCH(req(`/api/studio/campaigns/${cmpId}`, { method: "PATCH", token: otherAdmin, body: { experienceId: FF_EXPERIENCE } }), ctx(cmpId));
    expect(repoint.status).toBe(400);
    expect((await getRepository().campaign.findById(cmpId))!.experienceId).toBe(own);
  });

  it("artist roles cannot widen scope with ?artistId= on readiness (404, nothing leaked)", async () => {
    const res = await publishRoute.GET(req(`/api/studio/experiences/${FF_EXPERIENCE}/publish?artistId=art_001`, { token: otherAdmin }), ctx(FF_EXPERIENCE));
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("Moonwave");
  });

  it("readiness for an artist's own experience never includes another artist's campaigns or release", async () => {
    const own = await newExperience(otherAdmin);
    const r = (await readiness(own, otherAdmin)).body!;
    expect(r.campaigns.every((c) => c.id !== FF_CAMPAIGN)).toBe(true);
    expect(r.release).toBeNull();
  });

  it("a foreign scene smuggled into the draft (bypassing the API) blocks publishing and leaks nothing", async () => {
    const repo = getRepository();
    const foreign = await repo.scene.create({ artistId: otherArtistId, name: "SECRET_SCENE_NAME", canvasWidth: 1280, canvasHeight: 720 }, "test");
    await repo.scene.save(foreign.id, { ...foreign.schema, objects: [{ ...textObject("obj_secret"), name: "SECRET_OBJECT_NAME" }] });
    const id = await newExperience(admin);
    await repo.experience.update(id, {
      scenes: [{ sceneId: foreign.id, order: 0, transitionType: "cut", transitionDuration: 0 }],
      editableParameters: [{ id: "ep_x", sceneId: foreign.id, objectId: "obj_secret", property: "style.fill", label: "P", type: "color", defaultValue: "#fff" }],
    });

    const res = await publishRoute.GET(req(`/api/studio/experiences/${id}/publish`, { token: admin }), ctx(id));
    expect(res.status).toBe(200);
    const raw = await res.text();
    expect(raw).not.toContain("SECRET_SCENE_NAME");
    expect(raw).not.toContain("SECRET_OBJECT_NAME");
    const r = (JSON.parse(raw) as { readiness: ExperienceReadiness }).readiness;
    expect(r.ready).toBe(false);
    expect(r.issues.map((i) => i.code)).toEqual(expect.arrayContaining(["SCENE_FOREIGN", "PARAM_SCENE_MISSING"]));

    const post = await publishRoute.POST(req(`/api/studio/experiences/${id}/publish`, { method: "POST", token: admin }), ctx(id));
    expect(post.status).toBe(422);
    expect(await post.text()).not.toContain("SECRET_");
    expect(await repo.experience.listVersions(id)).toHaveLength(0);
  });
});

describe("Publish integrity — the POST is authoritative (no TOCTOU on readiness)", () => {
  it("a stale 'ready' readiness does not let a now-invalid draft publish; live version is untouched", async () => {
    const repo = getRepository();
    const scene = await sceneWithObject(admin);
    const id = await newExperience(admin);
    const seq = { scenes: [{ sceneId: scene.id, order: 0, transitionType: "fade", transitionDuration: 600 }] };
    expect((await experienceRoute.PATCH(req(`/api/studio/experiences/${id}`, { method: "PATCH", token: admin, body: seq }), ctx(id))).status).toBe(200);
    expect((await publishRoute.POST(req(`/api/studio/experiences/${id}/publish`, { method: "POST", token: admin }), ctx(id))).status).toBe(201);
    const liveBefore = (await repo.experience.findById(id))!.currentVersionId;
    expect(liveBefore).not.toBeNull();

    expect((await readiness(id, admin)).body!.ready).toBe(true); // what a client would have cached
    // State changes after the check: the draft loses its scenes.
    expect((await experienceRoute.PATCH(req(`/api/studio/experiences/${id}`, { method: "PATCH", token: admin, body: { scenes: [] } }), ctx(id))).status).toBe(200);

    // A forged body claiming readiness is ignored; the server re-validates the stored draft.
    const post = await publishRoute.POST(req(`/api/studio/experiences/${id}/publish`, { method: "POST", token: admin, body: { ready: true, issues: [] } }), ctx(id));
    expect(post.status).toBe(422);
    expect((await repo.experience.findById(id))!.currentVersionId).toBe(liveBefore);
    expect(await repo.experience.listVersions(id)).toHaveLength(1);
  });

  it("editors and fans cannot publish even when readiness says ready; other artists get 404", async () => {
    const scene = await sceneWithObject(admin);
    const id = await newExperience(admin);
    await experienceRoute.PATCH(
      req(`/api/studio/experiences/${id}`, { method: "PATCH", token: admin, body: { scenes: [{ sceneId: scene.id, order: 0, transitionType: "cut", transitionDuration: 0 }] } }),
      ctx(id)
    );
    expect((await readiness(id, editor)).body!.ready).toBe(true);
    const post = (token: string) => publishRoute.POST(req(`/api/studio/experiences/${id}/publish`, { method: "POST", token }), ctx(id));
    expect((await post(editor)).status).toBe(403);
    expect((await post(fan)).status).toBe(403);
    expect((await post(otherAdmin)).status).toBe(404);
    expect(await getRepository().experience.listVersions(id)).toHaveLength(0);
  });
});
