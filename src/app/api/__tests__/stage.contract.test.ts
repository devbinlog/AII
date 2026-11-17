// @vitest-environment node
import { describe, it, expect, beforeAll, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/repository", async () => {
  const { mockRegistry } = await import("@/lib/mock/adapters");
  return { getRepository: () => mockRegistry, resetRepository: () => {} };
});

import { getRepository } from "@/lib/repository";
import { GET, PUT } from "@/app/api/studio/stage/route";
import { defaultStageLayout, moveItem, type StageLayout } from "@/lib/stage";

const req = (method: "GET" | "PUT", token?: string, body?: unknown) => {
  const headers = new Headers();
  if (token) headers.set("cookie", `aii_session=${token}`);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest("http://localhost:3000/api/studio/stage", { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
};

let admin: string;
let editor: string;
let fan: string;
beforeAll(async () => {
  const repo = getRepository();
  admin = (await repo.auth.signIn("studio@freefallers.com", "x")).sessionToken;
  editor = (await repo.auth.signIn("editor@freefallers.com", "x")).sessionToken;
  fan = (await repo.auth.signIn("fan1@example.com", "x")).sessionToken;
});

describe("/api/studio/stage", () => {
  it("requires a Studio role", async () => {
    expect((await GET(req("GET"))).status).toBe(401);
    expect((await GET(req("GET", fan))).status).toBe(403);
    expect((await PUT(req("PUT", fan, defaultStageLayout("art_001")))).status).toBe(403);
  });

  it("returns the default layout before anything is saved", async () => {
    const res = await GET(req("GET", admin));
    const json = (await res.json()) as { layout: StageLayout; saved: boolean };
    expect(res.status).toBe(200);
    expect(json.saved).toBe(false);
    expect(json.layout.items.length).toBe(defaultStageLayout("art_001").items.length);
  });

  it("saves a legal layout and restores it; artistId comes from the session", async () => {
    const moved = { ...moveItem(defaultStageLayout("art_001"), "member-vocal", [1.5, 0, 2]), artistId: "art_someone_else" };
    const res = await PUT(req("PUT", editor, moved));
    expect(res.status).toBe(200);
    const saved = ((await res.json()) as { layout: StageLayout }).layout;
    expect(saved.artistId).toBe("art_001");

    const back = (await (await GET(req("GET", admin))).json()) as { layout: StageLayout; saved: boolean };
    expect(back.saved).toBe(true);
    expect(back.layout.items.find((i) => i.id === "member-vocal")?.position).toEqual([1.5, 0, 2]);
  });

  it("rejects moved drums/amps, unlocked amps, out-of-bounds and extra items", async () => {
    const base = defaultStageLayout("art_001");
    const tamper = (fn: (l: StageLayout) => StageLayout) => PUT(req("PUT", admin, fn(structuredClone(base))));

    const drums = await tamper((l) => ({ ...l, items: l.items.map((i) => (i.id === "drums" ? { ...i, position: [2, 0, 0] } : i)) }));
    expect(drums.status).toBe(422);
    expect(await drums.json()).toMatchObject({ error: { code: "INVALID_LAYOUT" } });

    expect((await tamper((l) => ({ ...l, items: l.items.map((i) => (i.id === "amp-bass" ? { ...i, locked: false, position: [0, 0, 0] } : i)) }))).status).toBe(422);
    expect((await tamper((l) => ({ ...l, items: l.items.map((i) => (i.id === "guitar" ? { ...i, position: [40, 0, 0] } : i)) }))).status).toBe(422);
    expect((await tamper((l) => ({ ...l, items: [...l.items, { id: "operator-avatar", kind: "performer", label: "Operator", position: [0, 0, 3.5], rotationY: 0, locked: false }] }))).status).toBe(422);
    expect((await PUT(req("PUT", admin, { version: 2, items: [] }))).status).toBe(400);
  });
});
