import { describe, it, expect } from "vitest";
import { getArtistTheme } from "../artist-theme";
import { MOCK_ARTISTS } from "@/lib/mock/fixtures";

describe("getArtistTheme", () => {
  it("derives Freefallers' theme from existing branding without new fields", () => {
    const t = getArtistTheme(MOCK_ARTISTS[0]!);
    expect(t.primary).toBe("#e8192c");
    expect(t.cssVars["--artist-primary"]).toBe("#e8192c");
    expect([0, 1, 2]).toContain(t.motion);
    expect(t.typePreset).toBe("editorial-sans");
  });

  it("falls back to AII values for invalid colors (no CSS injection via branding)", () => {
    const base = MOCK_ARTISTS[0]!.branding;
    const t = getArtistTheme({ branding: { ...base, primaryColor: "red; background:url(x)", motionPreset: "expressive", fontFamily: "Space Mono" } });
    expect(t.primary).toBe("#e44942");
    expect(t.motion).toBe(2);
    expect(t.typePreset).toBe("mono-tech");
  });
});
