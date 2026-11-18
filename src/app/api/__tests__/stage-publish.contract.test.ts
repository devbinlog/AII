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
import { CURRENT_BACKLINE, defaultStageLayout, moveItem, setRoleOnStage, upgradeBackline, type StageItem, type StageLayout } from "@/lib/stage";

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

describe("Default layout change (2026-11-18) leaves stored layouts alone", () => {
  // The pre-change arrangement: guitar & keys on audience left (-X), bass on the right (+X).
  const legacy = () => {
    const l = defaultStageLayout("art_001");
    const at: Record<string, [number, number, number]> = {
      "member-guitar": [-2.5, 0, 0.5], guitar: [-2.5, 0, 1],
      "member-bass": [2.5, 0, 0.5], bass: [2.5, 0, 1],
      "member-keys": [-4.5, 0, -1.6], keyboard: [-4.25, 0, -0.75],
    };
    return { ...l, items: l.items.map((i) => (at[i.id] ? { ...i, position: at[i.id]! } : i)) };
  };

  it("a draft saved in the old arrangement is accepted and returned unchanged", async () => {
    expect((await save(admin, legacy())).status).toBe(200);
    const draft = ((await (await studioStage.GET(req("/api/studio/stage", "GET", admin))).json()) as { layout: { items: StageItem[] } }).layout.items;
    for (const id of ["member-guitar", "guitar", "member-bass", "bass", "member-keys", "keyboard"]) {
      expect(pos(draft, id)).toEqual(legacy().items.find((i) => i.id === id)!.position);
    }
  });

  it("a version published from it keeps the old coordinates, independent of the new default", async () => {
    expect((await publish(admin)).status).toBe(201);
    const pub = await publicItems();
    expect(pos(pub.items, "member-bass")).toEqual([2.5, 0, 0.5]);
    expect(pos(pub.items, "keyboard")).toEqual([-4.25, 0, -0.75]);
    // …while the default itself is the new audience-facing one
    expect(pos(defaultStageLayout("art_001").items, "member-bass")).toEqual([-2.5, 0, 0.5]);
  });

  it("resetting to the default is an explicit save, and only then changes the draft — not the published version", async () => {
    const before = await publicItems();
    expect((await save(admin, defaultStageLayout("art_001"))).status).toBe(200);
    const draft = ((await (await studioStage.GET(req("/api/studio/stage", "GET", admin))).json()) as { layout: { items: StageItem[] } }).layout.items;
    expect(pos(draft, "member-bass")).toEqual([-2.5, 0, 0.5]);
    expect((await publicItems()).items).toEqual(before.items);
  });
});

describe("Backline compatibility: stored drafts are never changed without the artist", () => {
  const P = (x: number, z: number) => [x, 0, z] as [number, number, number];
  const getDraft = async () =>
    (await (await studioStage.GET(req("/api/studio/stage", "GET", admin))).json()) as { layout: StageLayout; backline: { version: number; current: number } };
  /** Stored before versioning: no backlineVersion, original amps, artist-moved vocal. */
  const legacyStored = (): StageLayout => {
    const l = defaultStageLayout("art_001", "2026-11-01T00:00:00Z", 1);
    const { backlineVersion: _v, ...rest } = l;
    void _v;
    return { ...rest, items: l.items.map((i) => (i.id === "member-vocal" ? { ...i, position: P(0.75, 2) } : i)) };
  };

  it("1. a reader with no draft gets the current backline", async () => {
    const other = (await (await studioStage.GET(req("/api/studio/stage", "GET", otherAdmin))).json()) as { layout: StageLayout; backline: { version: number } };
    expect(other.backline.version).toBe(CURRENT_BACKLINE);
    expect(pos(other.layout.items, "amp-bass")).toEqual([-3.5, 0, -2.75]);
  });

  it("5. reading a legacy draft returns it unchanged and writes nothing", async () => {
    const stored = await getRepository().stage.save(legacyStored());
    const d = await getDraft();
    expect(d.layout.items).toEqual(stored.items);
    expect(d.backline).toEqual({ version: 1, current: CURRENT_BACKLINE });
    expect(await getRepository().stage.get("art_001")).toEqual(stored); // byte-identical, same updatedAt
  });

  it("6. load → save round-trip of a legacy draft is lossless", async () => {
    const before = await getRepository().stage.get("art_001");
    const loaded = (await getDraft()).layout;
    expect((await save(admin, loaded)).status).toBe(200);
    const after = await getRepository().stage.get("art_001");
    expect(after!.items).toEqual(before!.items);
    expect("backlineVersion" in after!).toBe(false);
  });

  it("3. publishing a legacy draft snapshots exactly its coordinates; later changes never touch it", async () => {
    expect((await publish(admin)).status).toBe(201);
    const pub = await publicItems();
    expect(pos(pub.items, "amp-bass")).toEqual([3.5, 0, -2.75]); // original backline, as the artist arranged it
    expect(pos(pub.items, "member-vocal")).toEqual([0.75, 0, 2]);
    const snapshot = structuredClone(pub.items);
    // 4. explicit upgrade: only locked gear moves, only when saved
    expect((await save(admin, upgradeBackline((await getDraft()).layout))).status).toBe(200);
    const up = await getDraft();
    expect(up.backline.version).toBe(CURRENT_BACKLINE);
    expect(pos(up.layout.items, "amp-bass")).toEqual([-3.5, 0, -2.75]);
    expect(pos(up.layout.items, "member-vocal")).toEqual([0.75, 0, 2]);
    expect((await publicItems()).items).toEqual(snapshot); // published version immutable
  });

  it("4. after upgrading, saving the old backline again is rejected (no silent downgrade)", async () => {
    const res = await save(admin, legacyStored());
    expect(res.status).toBe(422);
  });

  it("tampering is still rejected on either backline", async () => {
    const cur = (await getDraft()).layout;
    const moved = { ...cur, items: cur.items.map((i) => (i.id === "amp-keys" ? { ...i, position: P(0, 0) } : i)) };
    expect((await save(admin, moved)).status).toBe(422);
    const claimOld = { ...cur, backlineVersion: 1 as const };
    expect((await save(admin, claimOld)).status).toBe(422);
  });
});

describe("Lineup picker: benched roles", () => {
  const getDraft = async () => ((await (await studioStage.GET(req("/api/studio/stage", "GET", admin))).json()) as { layout: StageLayout }).layout;
  const ids = (items: StageItem[]) => items.map((i) => i.id);

  it("a benched role is saved, read back and published without its member and instrument", async () => {
    const start = moveItem(await getDraft(), "member-vocal", [1, 0, 2]);
    const lineup = setRoleOnStage(setRoleOnStage(start, "keys", false), "guitar", false);
    expect((await save(admin, lineup)).status).toBe(200);

    const read = await getDraft();
    expect(read.benched).toEqual(["guitar", "keys"]);
    for (const gone of ["member-keys", "keyboard", "member-guitar", "guitar"]) expect(ids(read.items)).not.toContain(gone);
    for (const fixed of ["amp-keys", "amp-guitar", "drums"]) expect(ids(read.items)).toContain(fixed);
    expect(pos(read.items, "member-vocal")).toEqual([1, 0, 2]);

    // Reading never re-adds them, and a load → save round-trip is lossless
    const before = await getRepository().stage.get("art_001");
    expect((await save(admin, read)).status).toBe(200);
    expect((await getRepository().stage.get("art_001"))!.items).toEqual(before!.items);

    expect((await publish(admin)).status).toBe(201);
    expect(ids((await publicItems()).items)).not.toContain("member-keys");
  });

  it("bringing a role back restores it at its default spot; the published version is unchanged", async () => {
    const published = structuredClone((await publicItems()).items);
    const back = setRoleOnStage(await getDraft(), "keys", true);
    expect((await save(admin, back)).status).toBe(200);
    const read = await getDraft();
    expect(read.benched).toEqual(["guitar"]);
    expect(pos(read.items, "member-keys")).toEqual(pos(defaultStageLayout("x").items, "member-keys"));
    expect((await publicItems()).items).toEqual(published);
  });

  it("inconsistent lineups: benched item present or empty band rejected; un-benched item cannot be dropped", async () => {
    const cur = await getDraft();
    const claimed = { ...cur, benched: ["guitar", "vocal"] }; // vocal still on stage
    expect((await save(admin, claimed)).status).toBe(422);
    // An item dropped without benching its role is not removed: additive normalization restores it.
    const dropped = { ...cur, items: cur.items.filter((i) => i.id !== "bass") };
    const res = await save(admin, dropped);
    expect(res.status).toBe(200);
    expect(ids(((await res.json()) as { layout: StageLayout }).layout.items)).toContain("bass");
    const empty = {
      ...cur,
      benched: ["vocal", "guitar", "bass", "keys", "drums"],
      items: cur.items.filter((i) => i.locked),
    };
    expect((await save(admin, empty)).status).toBe(422);
    expect((await save(admin, { ...cur, benched: ["bass", "bass"] })).status).toBe(400);
  });
});
