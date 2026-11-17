import { describe, it, expect } from "vitest";
import { getSessionTokenFromCookieHeader } from "../cookie";
import {
  canDeleteArtwork,
  canEditArtwork,
  canViewArtwork,
  isSessionValid,
  validateArtworkUpdate,
} from "../artwork-access";
import type { FanArtwork, Session } from "@/types";

const future = new Date(Date.now() + 60_000).toISOString();
const past = new Date(Date.now() - 60_000).toISOString();

function session(userId: string, role: Session["role"] = "fan", expiresAt = future): Session {
  return { userId, role, artistId: null, expiresAt, isMock: true };
}

function artwork(overrides: Partial<FanArtwork> = {}): FanArtwork {
  return {
    id: "art_x",
    campaignId: "cmp_001",
    experienceVersionId: "expv_001",
    creatorId: "usr_a",
    sessionToken: null,
    title: "t",
    imageUrl: null,
    customization: {
      versionId: "expv_001",
      editableParameters: {},
      sceneStates: {},
      captureFrameMs: 0,
      deterministicSeed: 42,
    },
    permission: "public",
    status: "published",
    moderationStatus: "approved",
    likeCount: 0,
    shareCount: 0,
    likedBy: [],
    createdAt: past,
    updatedAt: past,
    ...overrides,
  };
}

const owner = session("usr_a");
const other = session("usr_b");
const admin = session("usr_admin", "platform_admin");

describe("getSessionTokenFromCookieHeader", () => {
  it("reads the token at start, middle and without spaces", () => {
    expect(getSessionTokenFromCookieHeader("aii_session=a")).toBe("a");
    expect(getSessionTokenFromCookieHeader("x=1; aii_session=b; y=2")).toBe("b");
    expect(getSessionTokenFromCookieHeader("x=1;aii_session=c")).toBe("c");
  });

  it("does not match cookies whose name merely ends with aii_session", () => {
    expect(getSessionTokenFromCookieHeader("xaii_session=evil")).toBeNull();
    expect(getSessionTokenFromCookieHeader("foo=aii_session=evil")).toBeNull();
    expect(getSessionTokenFromCookieHeader("")).toBeNull();
  });
});

describe("isSessionValid", () => {
  it("rejects null and expired sessions", () => {
    expect(isSessionValid(null)).toBe(false);
    expect(isSessionValid(session("u", "fan", past))).toBe(false);
    expect(isSessionValid(owner)).toBe(true);
  });
});

describe("canViewArtwork", () => {
  it("public/unlisted are visible to everyone", () => {
    expect(canViewArtwork(artwork(), null)).toBe(true);
    expect(canViewArtwork(artwork({ permission: "unlisted" }), other)).toBe(true);
  });

  it("private is visible only to the creator", () => {
    const a = artwork({ permission: "private" });
    expect(canViewArtwork(a, owner)).toBe(true);
    expect(canViewArtwork(a, other)).toBe(false);
    expect(canViewArtwork(a, null)).toBe(false);
  });

  it("private anonymous artwork is visible to no logged-in user", () => {
    const a = artwork({ permission: "private", creatorId: null, sessionToken: "anon" });
    expect(canViewArtwork(a, other)).toBe(false);
  });

  it("removed artwork is never visible", () => {
    expect(canViewArtwork(artwork({ status: "removed" }), owner)).toBe(false);
  });
});

describe("canEditArtwork / canDeleteArtwork", () => {
  it("creator can edit and delete; others cannot", () => {
    expect(canEditArtwork(artwork(), owner)).toBe(true);
    expect(canDeleteArtwork(artwork(), owner)).toBe(true);
    expect(canEditArtwork(artwork(), other)).toBe(false);
    expect(canDeleteArtwork(artwork(), other)).toBe(false);
  });

  it("anonymous artwork cannot be edited or deleted by an arbitrary user", () => {
    const anon = artwork({ creatorId: null, sessionToken: "anon" });
    expect(canEditArtwork(anon, other)).toBe(false);
    expect(canDeleteArtwork(anon, other)).toBe(false);
  });

  it("platform admin can edit but not hard-delete others' artwork", () => {
    expect(canEditArtwork(artwork(), admin)).toBe(true);
    expect(canDeleteArtwork(artwork(), admin)).toBe(false);
  });
});

describe("validateArtworkUpdate", () => {
  it("passes only whitelisted, valid fields", () => {
    const r = validateArtworkUpdate(
      { title: "  New  ", permission: "private", likeCount: 999, creatorId: "usr_b" },
      artwork(),
      owner
    );
    expect(r).toEqual({ ok: true, update: { title: "New", permission: "private" } });
  });

  it("rejects invalid values", () => {
    expect(validateArtworkUpdate({ permission: "everyone" }, artwork(), owner)).toMatchObject({ ok: false, status: 400 });
    expect(validateArtworkUpdate({ status: "bogus" }, artwork(), owner)).toMatchObject({ ok: false, status: 400 });
    expect(validateArtworkUpdate({ title: "" }, artwork(), owner)).toMatchObject({ ok: false, status: 400 });
    expect(validateArtworkUpdate("x", artwork(), owner)).toMatchObject({ ok: false, status: 400 });
  });

  it("creator cannot move a flagged/removed artwork out of moderation", () => {
    expect(validateArtworkUpdate({ status: "published" }, artwork({ status: "flagged" }), owner)).toMatchObject({
      ok: false,
      status: 403,
      code: "MODERATION_LOCKED",
    });
  });

  it("creator cannot set moderation statuses; admin can", () => {
    expect(validateArtworkUpdate({ status: "removed" }, artwork(), owner)).toMatchObject({ ok: false, status: 403 });
    expect(validateArtworkUpdate({ status: "published" }, artwork({ status: "flagged" }), admin)).toMatchObject({ ok: true });
  });

  it("creator can still change visibility of a flagged artwork", () => {
    expect(validateArtworkUpdate({ permission: "private" }, artwork({ status: "flagged" }), owner)).toMatchObject({ ok: true });
  });
});
