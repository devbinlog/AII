// @vitest-environment node
/**
 * WS-06 canvas direct manipulation — persistence contract (MOCK_ONLY).
 * Canvas edits only ever change existing SceneTransform / locked fields; these tests
 * check that such drafts save and reload exactly, that reading writes nothing, that
 * published versions keep the old transform, that scenes stay isolated, and that the
 * server-side permission checks still apply.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/repository", async () => {
  const { mockRegistry } = await import("@/lib/mock/adapters");
  return { getRepository: () => mockRegistry, resetRepository: () => {} };
});

import { getRepository } from "@/lib/repository";
import * as scenesRoute from "@/app/api/studio/scenes/route";
import * as sceneRoute from "@/app/api/studio/scenes/[id]/route";
import * as experiencesRoute from "@/app/api/studio/experiences/route";
import * as experienceRoute from "@/app/api/studio/experiences/[id]/route";
import * as experiencePublishRoute from "@/app/api/studio/experiences/[id]/publish/route";
import { createSceneObject } from "@/lib/studio/scene-objects";
import { localBox, moveTransform, nudgeTransform, resizeTransform, rotateTransform } from "@/lib/studio/scene-geometry";
import type { Scene, SceneSchema } from "@/types";

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

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

let admin: string;
let editor: string;
let fan: string;
let otherAdmin: string;

beforeAll(async () => {
  const repo = getRepository();
  admin = (await repo.auth.signIn("studio@freefallers.com", "x")).sessionToken;
  editor = (await repo.auth.signIn("editor@freefallers.com", "x")).sessionToken;
  fan = (await repo.auth.signIn("fan1@example.com", "x")).sessionToken;
  const other = await repo.artist.create({ slug: "ws06-other", name: "WS06 Other", bio: "", genre: [] }, "test");
  await repo.auth.createUser({ email: "ws06-other@example.com", password: "x", displayName: "Other" });
  const signed = await repo.auth.signIn("ws06-other@example.com", "x");
  signed.session.role = "artist_admin";
  signed.session.artistId = other.id;
  otherAdmin = signed.sessionToken;
});

async function createScene(name: string): Promise<Scene> {
  const res = await scenesRoute.POST(req("/api/studio/scenes", { method: "POST", token: editor, body: { name } }));
  expect(res.status).toBe(201);
  return (await json<{ scene: Scene }>(res)).scene;
}

const save = (token: string, id: string, schema: SceneSchema) =>
  sceneRoute.PUT(req(`/api/studio/scenes/${id}`, { method: "PUT", token, body: { schema } }), ctx(id));

async function load(id: string, token = editor): Promise<Scene> {
  const res = await sceneRoute.GET(req(`/api/studio/scenes/${id}`, { token }), ctx(id));
  expect(res.status).toBe(200);
  return (await json<{ scene: Scene }>(res)).scene;
}

/** What the canvas editor does: move, resize, rotate, nudge — producing only SceneTransform values. */
function manipulate(schema: SceneSchema, id: string): SceneSchema {
  const scene = { width: schema.canvasWidth, height: schema.canvasHeight };
  return {
    ...schema,
    objects: schema.objects.map((o) => {
      if (o.id !== id) return o;
      let t = moveTransform(o.transform, localBox(o), 137.4, -61.8, scene, { grid: 20 }).transform;
      t = resizeTransform(t, "se", 40, 25, { keepAspect: true });
      t = rotateTransform(t, [t.x, t.y - 100], [t.x + 100, t.y - 100], 15);
      t = nudgeTransform(t, localBox({ ...o, transform: t }), -1, 10, scene);
      return { ...o, transform: t, updatedAt: "2026-11-25T00:00:00.000Z" };
    }),
  };
}

async function seededScene(name: string): Promise<{ scene: Scene; schema: SceneSchema }> {
  const scene = await createScene(name);
  const rect = createSceneObject("rectangle", scene.schema, { id: "r1", now: "2026-11-25T00:00:00.000Z" });
  const text = createSceneObject("text", { ...scene.schema, objects: [rect] }, { id: "t1", now: "2026-11-25T00:00:00.000Z" });
  const schema: SceneSchema = { ...scene.schema, objects: [rect, text] };
  expect((await save(editor, scene.id, schema)).status).toBe(200);
  return { scene, schema };
}

describe("Canvas-edited scene drafts", () => {
  it("reading a scene (repeatedly) returns it unchanged and writes nothing", async () => {
    const { scene, schema } = await seededScene("WS06 read-only");
    const before = structuredClone(await getRepository().scene.findById(scene.id));
    const a = await load(scene.id);
    const b = await load(scene.id);
    expect(a.schema).toEqual(schema);
    expect(b).toEqual(a);
    expect(await getRepository().scene.findById(scene.id)).toEqual(before);
  });

  it("a moved/resized/rotated draft saves and reloads exactly, with no new schema fields", async () => {
    const { scene, schema } = await seededScene("WS06 round trip");
    const edited = manipulate(schema, "r1");
    expect(edited.objects[0]!.transform).not.toEqual(schema.objects[0]!.transform);
    expect(Object.keys(edited.objects[0]!.transform).sort()).toEqual(Object.keys(schema.objects[0]!.transform).sort());
    const res = await save(editor, scene.id, edited);
    expect(res.status).toBe(200);
    const reloaded = await load(scene.id);
    expect(reloaded.schema).toEqual(edited);
    // The untouched object is byte-identical
    expect(reloaded.schema.objects[1]).toEqual(schema.objects[1]);
  });

  it("the lock toggle persists through the existing `locked` field", async () => {
    const { scene, schema } = await seededScene("WS06 lock");
    const locked = { ...schema, objects: schema.objects.map((o) => (o.id === "r1" ? { ...o, locked: true } : o)) };
    expect((await save(editor, scene.id, locked)).status).toBe(200);
    expect((await load(scene.id)).schema.objects.find((o) => o.id === "r1")?.locked).toBe(true);
  });

  it("an out-of-range transform from a tampered client is still rejected by the DSL", async () => {
    const { scene, schema } = await seededScene("WS06 invalid");
    const bad = { ...schema, objects: schema.objects.map((o) => (o.id === "r1" ? { ...o, transform: { ...o.transform, width: -5 } } : o)) };
    const res = await save(editor, scene.id, bad);
    expect(res.status).toBe(400);
    expect((await load(scene.id)).schema).toEqual(schema);
  });

  it("editing one scene leaves another scene untouched", async () => {
    const one = await seededScene("WS06 isolation A");
    const two = await seededScene("WS06 isolation B");
    expect((await save(editor, one.scene.id, manipulate(one.schema, "r1"))).status).toBe(200);
    expect((await load(two.scene.id)).schema).toEqual(two.schema);
  });

  it("published versions keep the transform they were published with", async () => {
    const { scene, schema } = await seededScene("WS06 publish");
    const created = await experiencesRoute.POST(req("/api/studio/experiences", { method: "POST", token: editor, body: { title: "WS06 Experience" } }));
    const { experience } = await json<{ experience: { id: string } }>(created);
    await experienceRoute.PATCH(
      req(`/api/studio/experiences/${experience.id}`, {
        method: "PATCH",
        token: editor,
        body: { scenes: [{ sceneId: scene.id, order: 0, transitionType: "cut", transitionDuration: 0 }] },
      }),
      ctx(experience.id)
    );
    const pub = await experiencePublishRoute.POST(req(`/api/studio/experiences/${experience.id}/publish`, { method: "POST", token: admin }), ctx(experience.id));
    expect(pub.status).toBe(201);
    const versionId = (await json<{ version: { id: string } }>(pub)).version.id;

    expect((await save(editor, scene.id, manipulate(schema, "r1"))).status).toBe(200);
    const frozen = await getRepository().experience.findVersionById(versionId);
    expect(frozen?.snapshot.sceneSchemas[scene.id]).toEqual(schema);
  });

  it("server-side permissions still apply to transform saves", async () => {
    const { scene, schema } = await seededScene("WS06 auth");
    const edited = manipulate(schema, "r1");
    expect((await save("", scene.id, edited)).status).toBe(401);
    expect((await save(fan, scene.id, edited)).status).toBe(403);
    expect((await save(otherAdmin, scene.id, edited)).status).toBe(404);
    expect((await load(scene.id)).schema).toEqual(schema);
  });
});
