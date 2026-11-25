// @vitest-environment node
/** WS-07 multi-member stages through the real route handlers (mock repository). */
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
import { addMember, defaultStageLayout, moveItem, type StageItem, type StageLayout } from "@/lib/stage";

const BASE = "http://localhost:3000";
const req = (path: string, method: string, token?: string, body?: unknown) => {
  const headers = new Headers();
  if (token) headers.set("cookie", `aii_session=${token}`);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(`${BASE}${path}`, { method, headers, ...(body !== undefined ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}) });
};
const save = (token: string | undefined, layout: unknown) => studioStage.PUT(req("/api/studio/stage", "PUT", token, layout));
const load = async (token: string) => ((await (await studioStage.GET(req("/api/studio/stage", "GET", token))).json()) as { layout: StageLayout; versions: { id: string; version: number }[] });
const publish = (token: string) => publishRoute.POST(req("/api/studio/stage/publish", "POST", token));
const publicItems = async () => {
  const res = await publicStage(new Request(`${BASE}/api/artists/stage-members/stage`), { params: Promise.resolve({ slug: "stage-members" }) });
  return ((await res.json()) as { stage: { items: StageItem[]; version: number } }).stage;
};

let admin: string;
let editor: string;
let fan: string;
let otherAdmin: string;
let artistId: string;

beforeAll(async () => {
  // A dedicated artist so these tests never race the Freefallers stage suites.
  const repo = getRepository();
  const artist = await repo.artist.create({ slug: "stage-members", name: "Stage Members", bio: "", genre: [] }, "test");
  artistId = artist.id;
  const make = async (email: string, role: "artist_admin" | "artist_editor", forArtist: string) => {
    await repo.auth.createUser({ email, password: "x", displayName: email });
    const s = await repo.auth.signIn(email, "x");
    s.session.role = role; // test-only promotion
    s.session.artistId = forArtist;
    return s.sessionToken;
  };
  admin = await make("ws07-admin@example.com", "artist_admin", artistId);
  editor = await make("ws07-editor@example.com", "artist_editor", artistId);
  const other = await repo.artist.create({ slug: "stage-members-other", name: "Other", bio: "", genre: [] }, "test");
  otherAdmin = await make("ws07-other@example.com", "artist_admin", other.id);
  fan = (await repo.auth.signIn("fan1@example.com", "x")).sessionToken;
});

const ids = (k: string) => ({ memberId: `mbr-${k}0000a`, performerId: `perf-${k}0000a`, instrumentId: `inst-${k}0000a` });

function twoGuitars(): StageLayout {
  let l = defaultStageLayout("ignored-by-server");
  l = addMember(l, "guitar", ids("ga"));
  l = addMember(l, "guitar", ids("gb"));
  return moveItem(l, "perf-ga0000a", [1.25, 0, 2]);
}

describe("multi-member stage", () => {
  it("a legacy (built-in only) draft loads unchanged and stays unsaved by reading", async () => {
    expect(await getRepository().stage.get(artistId)).toBeNull();
    const first = await load(admin);
    expect(first.layout.items).toEqual(defaultStageLayout(artistId).items);
    expect(await getRepository().stage.get(artistId)).toBeNull(); // GET never writes
  });

  it("editors save two same-role members with independent positions and instruments; reload matches", async () => {
    const res = await save(editor, twoGuitars());
    expect(res.status).toBe(200);
    const { layout } = await load(editor);
    const members = layout.items.filter((i) => i.memberId && i.kind === "performer");
    expect(members.map((m) => [m.id, m.role, m.label])).toEqual([["perf-ga0000a", "guitar", "Guitar 2"], ["perf-gb0000a", "guitar", "Guitar 3"]]);
    expect(layout.items.find((i) => i.id === "perf-ga0000a")!.position).toEqual([1.25, 0, 2]);
    expect(layout.items.find((i) => i.id === "inst-gb0000a")).toMatchObject({ kind: "guitar", memberId: "mbr-gb0000a" });
    expect(layout.artistId).toBe(artistId); // from the session, not the body
  });

  it("publishing freezes the members; later draft edits never reach fans or older versions", async () => {
    expect((await publish(editor)).status).toBe(403);
    expect((await publish(admin)).status).toBe(201);
    const v1 = await publicItems();
    expect(v1.version).toBe(1);
    expect(v1.items.filter((i) => i.memberId).map((i) => i.id).sort()).toEqual(["inst-ga0000a", "inst-gb0000a", "perf-ga0000a", "perf-gb0000a"]);

    const { layout } = await load(admin);
    const edited = moveItem({ ...layout, items: layout.items.filter((i) => i.memberId !== "mbr-gb0000a") }, "perf-ga0000a", [-1, 0, 2.5]);
    expect((await save(admin, edited)).status).toBe(200);
    expect(await publicItems()).toEqual(v1);

    expect((await publish(admin)).status).toBe(201);
    const v2 = await publicItems();
    expect(v2.version).toBe(2);
    expect(v2.items.some((i) => i.memberId === "mbr-gb0000a")).toBe(false);
    const versions = await getRepository().stage.listVersions(artistId);
    const old = versions.find((v) => v.version === 1)!;
    expect(old.items).toEqual(v1.items); // the previous version is still intact
  });

  it("refuses forged or inconsistent member data", async () => {
    const good = twoGuitars();
    const bad = (patch: (items: StageItem[]) => StageItem[]) => ({ ...good, items: patch(structuredClone(good.items)) });
    const cases: [string, unknown][] = [
      ["unknown id", bad((items) => [...items, { id: "zz-extra", kind: "mic", label: "Mic", position: [0, 0, 0], rotationY: 0, locked: false }])],
      ["built-in role swap", bad((items) => items.map((i) => (i.id === "member-guitar" ? { ...i, role: "vocal" as const } : i)))],
      ["orphan instrument", bad((items) => items.map((i) => (i.id === "inst-gb0000a" ? { ...i, memberId: "mbr-ghost0001" } : i)))],
      ["wrong instrument for role", bad((items) => items.map((i) => (i.id === "inst-gb0000a" ? { ...i, kind: "bass" as const } : i)))],
      ["added backline", bad((items) => items.map((i) => (i.id === "inst-gb0000a" ? { ...i, kind: "amplifier" as const } : i)))],
      ["duplicate object id", bad((items) => items.map((i) => (i.id === "inst-gb0000a" ? { ...i, id: "perf-gb0000a" } : i)))],
    ];
    for (const [name, body] of cases) {
      const res = await save(admin, body);
      expect(res.status, name).toBe(422);
    }
    expect((await save(admin, bad((items) => items.map((i) => (i.id === "perf-ga0000a" ? { ...i, memberId: "<script>" } : i))))).status).toBe(400);
    expect((await save(admin, bad((items) => items.map((i) => (i.id === "perf-ga0000a" ? { ...i, role: "admin" as never } : i))))).status).toBe(400);
  });

  it("caps the payload: too many items and oversized labels are rejected by the schema", async () => {
    let l = defaultStageLayout("x");
    const many = { ...l, items: [...l.items, ...Array.from({ length: 30 }, (_, k) => ({ id: `perf-big${String(k).padStart(5, "0")}`, kind: "performer", label: "M", position: [0, 0, 0], rotationY: 0, locked: false, memberId: `mbr-big${String(k).padStart(5, "0")}`, role: "drums" }))] };
    expect((await save(admin, many)).status).toBe(400);
    l = addMember(l, "vocal", ids("lv"));
    const long = { ...l, items: l.items.map((i) => (i.id === "perf-lv0000a" ? { ...i, label: "x".repeat(41) } : i)) };
    expect((await save(admin, long)).status).toBe(400);
  });

  it("authorization is unchanged: anonymous 401, fans 403, other artists cannot touch this stage", async () => {
    expect((await save(undefined, twoGuitars())).status).toBe(401);
    expect((await save(fan, twoGuitars())).status).toBe(403);
    const before = await getRepository().stage.get(artistId);
    expect((await save(otherAdmin, twoGuitars())).status).toBe(200); // saves to THEIR artist (artistId from session)
    expect(await getRepository().stage.get(artistId)).toEqual(before);
  });
});
