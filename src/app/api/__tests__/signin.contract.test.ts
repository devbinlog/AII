// @vitest-environment node
/** /api/auth/signin: JSON for the hydrated form, form-post fallback for pre-hydration submits. */
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/repository", async () => {
  const { mockRegistry } = await import("@/lib/mock/adapters");
  return { getRepository: () => mockRegistry, resetRepository: () => {} };
});

const cookieSet = vi.fn();
vi.mock("next/headers", () => ({ cookies: async () => ({ set: cookieSet, get: () => undefined, delete: vi.fn() }) }));

import { POST } from "@/app/api/auth/signin/route";

const BASE = "http://localhost:3000";
const form = (fields: Record<string, string>, origin: string | null = BASE) =>
  new NextRequest(`${BASE}/api/auth/signin`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...(origin ? { origin } : {}) },
    body: new URLSearchParams(fields).toString(),
  });

describe("form-post sign-in (no JS)", () => {
  it("signs in, sets the session cookie and 303-redirects to the same-site target", async () => {
    cookieSet.mockClear();
    const res = await POST(form({ email: "fan1@example.com", password: "demo", redirect: "/me/artworks" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${BASE}/me/artworks`);
    expect(cookieSet).toHaveBeenCalled();
  });

  it("bad credentials bounce back to /login with an error, never exposing the password", async () => {
    const res = await POST(form({ email: "nobody@example.com", password: "secret-pw", redirect: "/studio" }));
    expect(res.status).toBe(303);
    const loc = res.headers.get("location")!;
    expect(loc).toContain("/login?error=invalid");
    expect(loc).toContain("redirect=%2Fstudio");
    expect(loc).not.toContain("secret-pw");
  });

  it("rejects an off-site redirect (open-redirect guard)", async () => {
    for (const redirect of ["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)"]) {
      const res = await POST(form({ email: "fan1@example.com", password: "demo", redirect }));
      expect(res.headers.get("location")).toBe(`${BASE}/me/artworks`);
    }
  });

  it("rejects cross-site or origin-less form posts (login CSRF)", async () => {
    expect((await POST(form({ email: "fan1@example.com", password: "demo" }, "https://evil.example"))).status).toBe(403);
    expect((await POST(form({ email: "fan1@example.com", password: "demo" }, null))).status).toBe(403);
  });
});

describe("JSON sign-in (hydrated form) is unchanged", () => {
  const json = (body: unknown) => new NextRequest(`${BASE}/api/auth/signin`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  it("returns ok + user", async () => {
    const res = await POST(json({ email: "fan1@example.com", password: "demo" }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
  });
  it("401 on unknown user, 400 on missing fields", async () => {
    expect((await POST(json({ email: "nobody@example.com", password: "x" }))).status).toBe(401);
    expect((await POST(json({ email: "fan1@example.com" }))).status).toBe(400);
  });
});
