import { describe, it, expect } from "vitest";
import {
  MAX_ADDED_MEMBERS,
  addMember,
  addedMembers,
  defaultStageLayout,
  instrumentOf,
  moveItem,
  normalizeStageLayout,
  parseStageLayout,
  performerRole,
  playerOf,
  referenceFor,
  removeMember,
  renameMember,
  setMemberRole,
  setRoleOnStage,
  validateAgainstReference,
  type NewMemberIds,
  type StageLayout,
} from "@/lib/stage";

const NOW = "2026-11-25T00:00:00.000Z";
let n = 0;
const ids = (): NewMemberIds => {
  n += 1;
  const k = String(n).padStart(6, "0");
  return { memberId: `mbr-m${k}`, performerId: `perf-p${k}`, instrumentId: `inst-i${k}` };
};
const base = () => defaultStageLayout("art_x", NOW);
const valid = (l: StageLayout) => validateAgainstReference(normalizeStageLayout(l, referenceFor(l, l.artistId)), referenceFor(l, l.artistId));

describe("legacy single-member layouts", () => {
  it("parse round-trips a legacy layout losslessly (same values, no new keys on any item)", () => {
    const legacy = base();
    const parsed = parseStageLayout(JSON.parse(JSON.stringify(legacy)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.layout).toEqual(legacy);
    parsed.layout.items.forEach((item, i) => expect(Object.keys(item).sort()).toEqual(Object.keys(legacy.items[i]!).sort()));
  });

  it("an unversioned v1 layout (pre-backline, no benched) is still valid and untouched by normalization", () => {
    const old = defaultStageLayout("art_x", NOW, 1);
    const { backlineVersion: _b, ...unversioned } = old;
    expect(valid(unversioned)).toEqual([]);
    expect(normalizeStageLayout(unversioned, referenceFor(unversioned, "art_x"))).toBe(unversioned);
  });

  it("built-in members keep deriving their role from their id", () => {
    const l = renameMember(base(), "member-guitar", "Mina");
    expect(performerRole(l.items.find((i) => i.id === "member-guitar")!)).toBe("guitar");
  });
});

describe("adding members", () => {
  it("allows several members of the same role with independent ids, labels, positions and instruments", () => {
    const a = ids();
    const b = ids();
    let l = addMember(base(), "guitar", a);
    l = addMember(l, "guitar", b);
    const added = addedMembers(l);
    expect(added.map((m) => m.role)).toEqual(["guitar", "guitar"]);
    expect(added.map((m) => m.label)).toEqual(["Guitar 2", "Guitar 3"]);
    expect(new Set(added.map((m) => m.memberId)).size).toBe(2);
    expect(added[0]!.id).not.toBe(added[0]!.memberId); // object id ≠ member id
    expect(added[0]!.position).not.toEqual(added[1]!.position);
    expect(instrumentOf(l, a.memberId)).toMatchObject({ id: a.instrumentId, kind: "guitar", memberId: a.memberId });
    expect(instrumentOf(l, b.memberId)).toMatchObject({ id: b.instrumentId, kind: "guitar", memberId: b.memberId });
    expect(playerOf(l, instrumentOf(l, b.memberId)!)?.id).toBe(b.performerId);
    expect(valid(l)).toEqual([]);
  });

  it("spawns members inside the stage and clear of the backline; drummers share the kit", () => {
    let l = base();
    for (const role of ["vocal", "bass", "keys", "drums"] as const) l = addMember(l, role, ids());
    expect(valid(l)).toEqual([]);
    const drummer = addedMembers(l).find((m) => m.role === "drums")!;
    expect(instrumentOf(l, drummer.memberId!)).toBeNull();
  });

  it("moving one same-role member never moves the other", () => {
    const a = ids();
    const b = ids();
    let l = addMember(addMember(base(), "vocal", a), "vocal", b);
    const before = l.items.find((i) => i.id === b.performerId)!.position;
    l = moveItem(l, a.performerId, [-1, 0, 2]);
    expect(l.items.find((i) => i.id === a.performerId)!.position).toEqual([-1, 0, 2]);
    expect(l.items.find((i) => i.id === b.performerId)!.position).toEqual(before);
  });

  it("respects the member limit and refuses id collisions", () => {
    let l = base();
    for (let i = 0; i < MAX_ADDED_MEMBERS; i++) l = addMember(l, "drums", ids());
    expect(addMember(l, "vocal", ids())).toBe(l);
    const dup = ids();
    const once = addMember(base(), "vocal", dup);
    expect(addMember(once, "vocal", dup)).toBe(once);
  });
});

describe("editing members", () => {
  it("rename updates the performer and its instrument label; built-in members can be renamed", () => {
    const a = ids();
    let l = addMember(base(), "bass", a);
    l = renameMember(l, a.performerId, "  Jae  ");
    expect(l.items.find((i) => i.id === a.performerId)!.label).toBe("Jae");
    expect(instrumentOf(l, a.memberId)!.label).toBe("Bass · Jae");
    expect(renameMember(l, a.performerId, "   ")).toBe(l);
    expect(renameMember(base(), "member-vocal", "Lead").items.find((i) => i.id === "member-vocal")!.label).toBe("Lead");
  });

  it("role change swaps the instrument kind and keeps the member id", () => {
    const a = ids();
    let l = addMember(base(), "guitar", a);
    l = setMemberRole(l, a.memberId, "keys", "inst-newkeys01");
    const perf = l.items.find((i) => i.id === a.performerId)!;
    expect(perf).toMatchObject({ role: "keys", memberId: a.memberId });
    expect(l.items.some((i) => i.id === a.instrumentId)).toBe(false);
    expect(instrumentOf(l, a.memberId)).toMatchObject({ id: "inst-newkeys01", kind: "keyboard" });
    l = setMemberRole(l, a.memberId, "drums", "inst-unused001");
    expect(instrumentOf(l, a.memberId)).toBeNull();
    expect(valid(l)).toEqual([]);
  });

  it("removing a member takes their instrument with them and leaves everything else", () => {
    const a = ids();
    const b = ids();
    const l = addMember(addMember(base(), "guitar", a), "guitar", b);
    const r = removeMember(l, a.memberId);
    expect(r.items.some((i) => i.memberId === a.memberId)).toBe(false);
    expect(r.items.filter((i) => i.memberId === b.memberId)).toHaveLength(2);
    expect(r.items.filter((i) => !i.memberId)).toEqual(base().items);
  });

  it("never removes the last performer on stage", () => {
    let l = base();
    for (const role of ["vocal", "guitar", "bass", "keys", "drums"] as const) l = setRoleOnStage(l, role, false);
    const a = ids();
    l = addMember(setRoleOnStage(base(), "vocal", true), "vocal", a);
    for (const role of ["vocal", "guitar", "bass", "keys", "drums"] as const) l = setRoleOnStage(l, role, false);
    expect(l.items.filter((i) => i.kind === "performer").map((i) => i.id)).toEqual([a.performerId]);
    expect(removeMember(l, a.memberId)).toBe(l);
  });
});

describe("server validation of added members", () => {
  const withOne = () => {
    const a = ids();
    return { a, l: addMember(base(), "guitar", a) };
  };
  const mutate = (l: StageLayout, id: string, patch: Record<string, unknown>) => ({ ...l, items: l.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }) as StageLayout;

  it("rejects ids outside the added-member namespace", () => {
    const { a, l } = withOne();
    expect(valid(mutate(l, a.performerId, { id: "hacker" })).join()).toMatch(/unknown item hacker/);
  });
  it("rejects a member id or role smuggled onto built-in items", () => {
    expect(valid(mutate(base(), "member-guitar", { role: "vocal" })).join()).toMatch(/built-in items cannot carry/);
    expect(valid(mutate(base(), "guitar", { memberId: "mbr-forged01" })).join()).toMatch(/built-in items cannot carry/);
  });
  it("rejects performers without role or member id, duplicate members, orphan or mismatched instruments", () => {
    const { a, l } = withOne();
    const { role: _r, ...noRole } = l.items.find((i) => i.id === a.performerId)!;
    expect(valid({ ...l, items: l.items.map((i) => (i.id === a.performerId ? noRole : i)) }).join()).toMatch(/need a role/);
    expect(valid(mutate(l, a.instrumentId, { memberId: "mbr-nobody01" })).join()).toMatch(/no member mbr-nobody01/);
    expect(valid(mutate(l, a.instrumentId, { kind: "keyboard" })).join()).toMatch(/cannot play keyboard/);
    const twin = { ...l.items.find((i) => i.id === a.performerId)!, id: "perf-twin0001" };
    expect(valid({ ...l, items: [...l.items, twin] }).join()).toMatch(/appears twice/);
    const second = { ...l.items.find((i) => i.id === a.instrumentId)!, id: "inst-second01" };
    expect(valid({ ...l, items: [...l.items, second] }).join()).toMatch(/already has an instrument/);
  });
  it("rejects added backline, locked added items and positions off stage", () => {
    const { a, l } = withOne();
    expect(valid(mutate(l, a.instrumentId, { kind: "amplifier" })).join()).toMatch(/backline cannot be added/);
    expect(valid(mutate(l, a.performerId, { locked: true })).join()).toMatch(/cannot be locked/);
    expect(valid(mutate(l, a.performerId, { position: [40, 0, 0] })).join()).toMatch(/outside the stage/);
  });
  it("rejects duplicate stage object ids", () => {
    const { a, l } = withOne();
    expect(valid(mutate(l, a.instrumentId, { id: a.performerId })).join()).toMatch(/duplicate item/);
  });
  it("schema rejects malformed member ids and roles before validation", () => {
    const { a, l } = withOne();
    expect(parseStageLayout(mutate(l, a.performerId, { memberId: "../../admin" })).ok).toBe(false);
    expect(parseStageLayout(mutate(l, a.performerId, { role: "conductor" })).ok).toBe(false);
  });
});

describe("serialization compatibility", () => {
  it("multi-member layouts round-trip through parse/serialize without loss", () => {
    let l = addMember(base(), "guitar", ids());
    l = addMember(l, "drums", ids());
    const parsed = parseStageLayout(JSON.parse(JSON.stringify(l)));
    expect(parsed.ok && parsed.layout).toEqual(l);
  });
  it("a published v1 snapshot without member fields still renders with the same roles", () => {
    const items = base().items;
    expect(items.filter((i) => i.kind === "performer").map(performerRole)).toEqual(["vocal", "guitar", "bass", "drums", "keys"]);
  });
});
