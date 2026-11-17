// @vitest-environment node
/**
 * Contract tests for the artwork API route handlers (MOCK_ONLY).
 * Calls the Next.js route handlers directly and asserts status codes and
 * response shapes, including authorization and privacy rules.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { NextRequest } from "next/server";

// repository.ts lazy-loads the mock registry with require(), which Node's
// native require cannot resolve for .ts sources under vitest's node env.
// Wire the same mock registry in directly.
vi.mock("@/lib/repository", async () => {
  const { mockRegistry } = await import("@/lib/mock/adapters");
  return { getRepository: () => mockRegistry, resetRepository: () => {} };
});
import { POST as signIn } from "@/app/api/auth/signin/route";
import { POST as createArtwork } from "@/app/api/artworks/route";
import { GET as getArtwork, PATCH as patchArtwork, DELETE as deleteArtwork } from "@/app/api/artworks/[id]/route";
import { POST as likeArtwork } from "@/app/api/artworks/[id]/like/route";
import { POST as flagArtwork } from "@/app/api/artworks/[id]/flag/route";
import { GET as myArtworks } from "@/app/api/me/artworks/route";

// signin calls cookies().set(), which needs a Next request scope.
// Sessions are created through the mock repository instead.
import { getRepository } from "@/lib/repository";

const BASE = "http://localhost:3000";
const CUSTOMIZATION = {
  versionId: "expv_001",
  editableParameters: {},
  sceneStates: {},
  captureFrameMs: 0,
  deterministicSeed: 42,
};

function req(path: string, init: { method?: string; cookie?: string; body?: unknown } = {}) {
  const headers = new Headers();
  if (init.cookie) headers.set("cookie", `aii_session=${init.cookie}`);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers,
    ...(init.body !== undefined ? { body: typeof init.body === "string" ? init.body : JSON.stringify(init.body) } : {}),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function login(email: string): Promise<string> {
  const { sessionToken } = await getRepository().auth.signIn(email, "any");
  return sessionToken;
}

async function create(cookie?: string, extra: Record<string, unknown> = {}): Promise<string> {
  const res = await createArtwork(
    req("/api/artworks", {
      method: "POST",
      ...(cookie ? { cookie } : {}),
      body: { campaignId: "cmp_001", experienceVersionId: "expv_001", title: "contract", customization: CUSTOMIZATION, ...extra },
    })
  );
  expect(res.status).toBe(201);
  const json = (await res.json()) as { ok: boolean; artwork: { id: string } };
  expect(json.ok).toBe(true);
  return json.artwork.id;
}

let fan1: string;
let fan2: string;
let admin: string;

beforeAll(async () => {
  fan1 = await login("fan1@example.com");
  fan2 = await login("fan2@example.com");
  admin = await login("admin@aii.music");
});

describe("POST /api/auth/signin", () => {
  it("rejects missing credentials with 400 and error envelope", async () => {
    const res = await signIn(req("/api/auth/signin", { method: "POST", body: {} }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
  });
});

describe("GET /api/me/artworks", () => {
  it("401 without session, including forged and suffix-named cookies", async () => {
    expect((await myArtworks(req("/api/me/artworks"))).status).toBe(401);
    expect((await myArtworks(req("/api/me/artworks", { cookie: "mock_session_usr_fan_001_1" }))).status).toBe(401);
    const suffixed = new NextRequest(`${BASE}/api/me/artworks`, { headers: { cookie: `xaii_session=${fan1}` } });
    expect((await myArtworks(suffixed)).status).toBe(401);
  });

  it("200 with { ok, artworks, total } for a signed-in fan", async () => {
    const res = await myArtworks(req("/api/me/artworks", { cookie: fan1 }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; artworks: unknown[]; total: number };
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.artworks)).toBe(true);
    expect(typeof json.total).toBe("number");
  });
});

describe("/api/artworks/[id] — private artwork", () => {
  let id: string;
  beforeAll(async () => {
    id = await create(fan1);
    const res = await patchArtwork(req(`/api/artworks/${id}`, { method: "PATCH", cookie: fan1, body: { permission: "private" } }), ctx(id));
    expect(res.status).toBe(200);
  });

  it("GET: 403 for anonymous and other users, 200 for creator", async () => {
    expect((await getArtwork(req(`/api/artworks/${id}`), ctx(id))).status).toBe(403);
    expect((await getArtwork(req(`/api/artworks/${id}`, { cookie: fan2 }), ctx(id))).status).toBe(403);
    expect((await getArtwork(req(`/api/artworks/${id}`, { cookie: fan1 }), ctx(id))).status).toBe(200);
  });

  it("like/flag by a user who cannot see it: 404", async () => {
    expect((await likeArtwork(req(`/api/artworks/${id}/like`, { method: "POST", cookie: fan2 }), ctx(id))).status).toBe(404);
    expect((await flagArtwork(req(`/api/artworks/${id}/flag`, { method: "POST", cookie: fan2, body: {} }), ctx(id))).status).toBe(404);
  });

  it("PATCH/DELETE by another user: 403 and artwork unchanged", async () => {
    expect((await patchArtwork(req(`/api/artworks/${id}`, { method: "PATCH", cookie: fan2, body: { title: "pwn" } }), ctx(id))).status).toBe(403);
    expect((await deleteArtwork(req(`/api/artworks/${id}`, { method: "DELETE", cookie: fan2 }), ctx(id))).status).toBe(403);
    const after = await getRepository().artwork.findById(id);
    expect(after?.title).toBe("contract");
  });
});

describe("/api/artworks/[id] — anonymous artwork", () => {
  let id: string;
  beforeAll(async () => {
    id = await create(undefined, { sessionToken: "anon_contract_token" });
  });

  it("cannot be modified, made private, or deleted by an arbitrary signed-in user", async () => {
    expect(
      (await patchArtwork(req(`/api/artworks/${id}`, { method: "PATCH", cookie: fan2, body: { permission: "private", title: "hijacked" } }), ctx(id))).status
    ).toBe(403);
    expect((await deleteArtwork(req(`/api/artworks/${id}`, { method: "DELETE", cookie: fan2 }), ctx(id))).status).toBe(403);
    const after = await getRepository().artwork.findById(id);
    expect(after).not.toBeNull();
    expect(after?.title).toBe("contract");
  });
});

describe("PATCH /api/artworks/[id] — validation and moderation", () => {
  it("401 without session, 404 for unknown id", async () => {
    expect((await patchArtwork(req("/api/artworks/x", { method: "PATCH", body: { title: "x" } }), ctx("x"))).status).toBe(401);
    expect((await patchArtwork(req("/api/artworks/nope", { method: "PATCH", cookie: fan1, body: { title: "x" } }), ctx("nope"))).status).toBe(404);
  });

  it("400 for invalid JSON and invalid values", async () => {
    const id = await create(fan1);
    expect((await patchArtwork(req(`/api/artworks/${id}`, { method: "PATCH", cookie: fan1, body: "{bad" }), ctx(id))).status).toBe(400);
    expect((await patchArtwork(req(`/api/artworks/${id}`, { method: "PATCH", cookie: fan1, body: { permission: "everyone" } }), ctx(id))).status).toBe(400);
  });

  it("ignores non-whitelisted fields", async () => {
    const id = await create(fan1);
    const res = await patchArtwork(req(`/api/artworks/${id}`, { method: "PATCH", cookie: fan1, body: { likeCount: 9999, creatorId: "usr_x", title: "ok" } }), ctx(id));
    expect(res.status).toBe(200);
    const { artwork } = (await res.json()) as { artwork: { likeCount: number; creatorId: string; title: string } };
    expect(artwork.likeCount).toBe(0);
    expect(artwork.creatorId).toBe("usr_fan_001");
    expect(artwork.title).toBe("ok");
  });

  it("creator publish flow (create → PATCH published/public) still works", async () => {
    const id = await create(fan1);
    const res = await patchArtwork(req(`/api/artworks/${id}`, { method: "PATCH", cookie: fan1, body: { status: "published", permission: "public" } }), ctx(id));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, artwork: { status: "published", permission: "public" } });
  });

  it("creator cannot re-publish a flagged artwork; admin can", async () => {
    const id = await create(fan1);
    // New artworks start private/draft; publish so other users can see and report it.
    expect(
      (await patchArtwork(req(`/api/artworks/${id}`, { method: "PATCH", cookie: fan1, body: { status: "published", permission: "public" } }), ctx(id))).status
    ).toBe(200);
    expect((await flagArtwork(req(`/api/artworks/${id}/flag`, { method: "POST", cookie: fan2, body: { reason: "spam" } }), ctx(id))).status).toBe(200);
    const locked = await patchArtwork(req(`/api/artworks/${id}`, { method: "PATCH", cookie: fan1, body: { status: "published" } }), ctx(id));
    expect(locked.status).toBe(403);
    expect(await locked.json()).toMatchObject({ ok: false, error: { code: "MODERATION_LOCKED" } });
    expect((await patchArtwork(req(`/api/artworks/${id}`, { method: "PATCH", cookie: admin, body: { status: "published" } }), ctx(id))).status).toBe(200);
  });
});

describe("DELETE /api/artworks/[id]", () => {
  it("404 for unknown id, 200 for creator, then 404", async () => {
    expect((await deleteArtwork(req("/api/artworks/nope", { method: "DELETE", cookie: fan1 }), ctx("nope"))).status).toBe(404);
    const id = await create(fan1);
    expect((await deleteArtwork(req(`/api/artworks/${id}`, { method: "DELETE", cookie: fan1 }), ctx(id))).status).toBe(200);
    expect((await getArtwork(req(`/api/artworks/${id}`), ctx(id))).status).toBe(404);
  });
});
