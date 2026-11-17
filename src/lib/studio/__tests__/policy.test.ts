import { describe, it, expect } from "vitest";
import { canPerform, hasStudioAccess, ownsResource, resolveStudioArtistId, type StudioAction } from "../policy";
import type { Session } from "@/types";

const s = (role: Session["role"], artistId: string | null = null): Session => ({
  userId: "u",
  role,
  artistId,
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  isMock: true,
});

const ALL: StudioAction[] = ["studio.view", "content.edit", "identity.edit", "release.publish", "experience.publish", "campaign.publish", "stage.publish", "media.delete"];

describe("Studio policy", () => {
  it("fans, owners without platform_admin, and artist roles without an artist have no access", () => {
    expect(hasStudioAccess(null)).toBe(false);
    expect(hasStudioAccess(s("fan"))).toBe(false);
    expect(hasStudioAccess(s("artist_admin", null))).toBe(false);
    for (const a of ALL) expect(canPerform(s("fan"), a)).toBe(false);
  });

  it("editors can view and edit drafts only", () => {
    const editor = s("artist_editor", "art_1");
    expect(ALL.filter((a) => canPerform(editor, a))).toEqual(["studio.view", "content.edit"]);
  });

  it("artist admins and platform admins can do everything", () => {
    for (const a of ALL) {
      expect(canPerform(s("artist_admin", "art_1"), a)).toBe(true);
      expect(canPerform(s("platform_admin"), a)).toBe(true);
    }
  });

  it("artist roles are pinned to their artist; platform admins choose", () => {
    expect(resolveStudioArtistId(s("artist_admin", "art_1"), "art_2")).toBe("art_1");
    expect(resolveStudioArtistId(s("platform_admin"), "art_2")).toBe("art_2");
    expect(resolveStudioArtistId(s("platform_admin"), null)).toBeNull();
  });

  it("ownsResource requires a matching artist", () => {
    expect(ownsResource("art_1", { artistId: "art_1" })).toBe(true);
    expect(ownsResource("art_1", { artistId: "art_2" })).toBe(false);
    expect(ownsResource("art_1", null)).toBe(false);
    expect(ownsResource(null, { artistId: "art_1" })).toBe(false);
  });
});
