import { describe, it, expect } from "vitest";
import { BRAND_FONTS, DEFAULT_LOGO, brandFontStack, brandName, initials, resolveLogo } from "../brand";

describe("brand kit helpers", () => {
  it("brand name falls back to the artist name", () => {
    expect(brandName({ wordmark: "FREE/FALLERS" }, "Freefallers")).toBe("FREE/FALLERS");
    expect(brandName({ wordmark: "   " }, "Freefallers")).toBe("Freefallers");
    expect(brandName({}, "Freefallers")).toBe("Freefallers");
  });

  it("initials take the first letters of up to two words", () => {
    expect(initials("Moon Wave Club")).toBe("MW");
    expect(initials("freefallers")).toBe("F");
    expect(initials("")).toBe("");
  });

  it("unknown or missing fonts use the platform default; stored keys never reach CSS raw", () => {
    expect(brandFontStack(null)).toBe(BRAND_FONTS.geist.stack);
    expect(brandFontStack("red; background:url(x)")).toBe(BRAND_FONTS.geist.stack);
    expect(brandFontStack("serif")).toBe(BRAND_FONTS.serif.stack);
  });

  it("an artist without a logo resolves to the wordmark-only default", () => {
    expect(resolveLogo({})).toEqual(DEFAULT_LOGO);
    expect(resolveLogo({ logo: null }).mark).toBe("none");
  });
});
