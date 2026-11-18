// @vitest-environment node
/** Dev-only mock reset fixture: restores fixtures, keeps sessions, never available in production. */
import { describe, it, expect, afterEach, vi } from "vitest";
import { POST } from "@/app/api/dev/reset-mock/route";
import { mockRegistry } from "@/lib/mock/adapters";

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/dev/reset-mock", () => {
  it("restores fixture data and keeps existing sessions", async () => {
    const { sessionToken } = await mockRegistry.auth.signIn("studio@freefallers.com", "x");
    const before = (await mockRegistry.campaign.listByArtist("art_001", { page: 1, pageSize: 100 })).total;
    await mockRegistry.stage.save({ version: 1, artistId: "art_001", items: [], updatedAt: "" } as never);
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await mockRegistry.stage.get("art_001")).toBeNull();
    expect((await mockRegistry.campaign.listByArtist("art_001", { page: 1, pageSize: 100 })).total).toBeLessThanOrEqual(before);
    expect(await mockRegistry.auth.getSession(sessionToken)).not.toBeNull();
  });

  it("resets in place, so every bundle's view of the store sees it", async () => {
    const g = globalThis as unknown as { __aiiMockStore: { campaigns: unknown[] } };
    await POST();
    const ref = g.__aiiMockStore.campaigns; // another bundle holds this same array instance
    const fixtureCount = ref.length;
    ref.push({ id: "junk" });
    await POST();
    expect(g.__aiiMockStore.campaigns).toBe(ref);
    expect(ref.length).toBe(fixtureCount);
  });

  it("is a 404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await POST()).status).toBe(404);
  });

  it("is a 404 outside MOCK_ONLY mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "production");
    expect((await POST()).status).toBe(404);
  });
});
