import { test, expect, type Page } from "@playwright/test";

// Explore's cover story and side rail repeat names on purpose; assert inside the results region.
const results = (page: Page) => page.getByRole("region", { name: "Results" });

// Public Discovery Flow: Home → Explore → Freefallers Artist Profile → Release Detail → Campaign Preview

test.describe("Home page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders editorial hero with AII wordmark", async ({ page }) => {
    await expect(page).toHaveTitle(/AII/);
    const heading = page.getByRole("heading", { name: "AII" });
    await expect(heading).toBeVisible();
  });

  test("shows Make Your Sound Visible tagline", async ({ page }) => {
    // DOM text is "Make Your Sound Visible"; CSS text-transform:uppercase handles visual rendering
    await expect(page.getByText(/Make Your Sound Visible/i).first()).toBeVisible();
  });

  test("links to Explore page", async ({ page }) => {
    const discoverLink = page.getByRole("link", { name: /Discover Artists/i }).first();
    await expect(discoverLink).toBeVisible();
    await expect(discoverLink).toHaveAttribute("href", "/explore");
  });

  test("shows Navbar with AII branding", async ({ page }) => {
    await expect(page.getByRole("link", { name: /AII/i }).first()).toBeVisible();
  });

  test("shows Footer", async ({ page }) => {
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });
});

test.describe("Explore page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/explore");
  });

  test("renders Explore heading", async ({ page }) => {
    await expect(page).toHaveTitle(/Explore/);
    await expect(page.getByRole("heading", { name: /explore/i })).toBeVisible();
  });

  test("shows Artists tab with Freefallers", async ({ page }) => {
    await expect(page.getByRole("button", { name: /artists/i })).toBeVisible();
    await expect(results(page).getByRole("heading", { name: "Freefallers" })).toBeVisible();
  });

  test("shows Releases tab with mock data", async ({ page }) => {
    await page.getByRole("button", { name: /releases/i }).click();
    await expect(results(page).getByText("Moonwave EP")).toBeVisible();
    await expect(results(page).getByText("Static Dreams")).toBeVisible();
  });

  test("shows Campaigns tab", async ({ page }) => {
    await page.getByRole("button", { name: /campaigns/i }).click();
    await expect(results(page).getByText("Moonwave Fan Artwork")).toBeVisible();
  });

  test("search filters artists", async ({ page }) => {
    const searchInput = page.getByRole("searchbox");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Freefallers");
    await expect(results(page).getByRole("heading", { name: "Freefallers" })).toBeVisible();
  });

  test("search with no match shows empty state", async ({ page }) => {
    const searchInput = page.getByRole("searchbox");
    await searchInput.fill("zzznomatch999");
    await expect(page.getByText(/No artists match/)).toBeVisible();
  });

  test("genre filter chips are visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: /electronic/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /ambient/i })).toBeVisible();
  });

  test("clicking artist card navigates to artist profile", async ({ page }) => {
    await results(page).getByRole("link", { name: "Freefallers", exact: true }).click();
    await expect(page).toHaveURL(/\/artists\/freefallers/);
  });
});

test.describe("Artist Profile — Freefallers", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/artists/freefallers");
  });

  test("renders artist name in heading", async ({ page }) => {
    await expect(page).toHaveTitle(/Freefallers/);
    await expect(page.getByRole("heading", { name: /Freefallers/i })).toBeVisible();
  });

  test("shows verified badge", async ({ page }) => {
    await expect(page.getByText("Verified")).toBeVisible();
  });

  test("shows follower count", async ({ page }) => {
    await expect(page.getByText("12.4K")).toBeVisible();
  });

  test("shows genre tags", async ({ page }) => {
    // "electronic" may appear multiple times (genre tags, filter chips) — any is fine
    await expect(page.getByText("electronic").first()).toBeVisible();
    await expect(page.getByText("ambient").first()).toBeVisible();
  });

  test("shows About bio section", async ({ page }) => {
    // DOM text is "About" — CSS text-transform:uppercase makes it display as "ABOUT"
    await expect(page.getByText("About")).toBeVisible();
    await expect(page.getByText(/서울을 기반으로/)).toBeVisible();
  });

  test("shows social links (Instagram, Spotify)", async ({ page }) => {
    await expect(page.getByRole("link", { name: /instagram/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /spotify/i })).toBeVisible();
  });

  test("shows Discography section with releases", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Discography" })).toBeVisible();
    // Release titles in cards
    await expect(page.getByText("Moonwave EP").first()).toBeVisible();
    await expect(page.getByText("Static Dreams").first()).toBeVisible();
  });

  test("shows Brand Identity section", async ({ page }) => {
    await expect(page.getByText("Brand Identity")).toBeVisible();
    await expect(page.getByText("#e8192c")).toBeVisible();
  });

  test("links to release detail from discography", async ({ page }) => {
    const releaseLink = page.getByRole("link", { name: /Moonwave EP/i }).first();
    await expect(releaseLink).toBeVisible();
    await releaseLink.click();
    await expect(page).toHaveURL(/\/releases\/rel_001/);
  });

  test("Back to Explore link works", async ({ page }) => {
    const backLink = page.getByRole("link", { name: /Back to Explore/i });
    await expect(backLink).toBeVisible();
    await backLink.click();
    await expect(page).toHaveURL("/explore");
  });

  test("returns 404 for unknown artist slug", async ({ page }) => {
    await page.goto("/artists/does-not-exist");
    const body = await page.textContent("body");
    expect(body).toMatch(/404|not found/i);
  });
});

test.describe("Release Detail — Moonwave EP", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/releases/rel_001");
  });

  test("renders release title", async ({ page }) => {
    await expect(page).toHaveTitle(/Moonwave EP/);
    await expect(page.getByRole("heading", { name: /MOONWAVE EP/i })).toBeVisible();
  });

  test("shows artist link to Freefallers", async ({ page }) => {
    // Multiple links may contain "Freefallers" (header link + bottom nav link)
    await expect(page.getByRole("link", { name: /Freefallers/i }).first()).toBeVisible();
  });

  test("shows release metadata (type, status, date)", async ({ page }) => {
    // Release metadata row shows "Release date", "tracks", "runtime" labels (no CSS transform)
    // .first() because "Release date" also matches "Release Date" in the Credits section (case-insensitive)
    await expect(page.getByText("Release date").first()).toBeVisible();
    await expect(page.getByText("tracks").first()).toBeVisible();
    await expect(page.getByText("runtime").first()).toBeVisible();
  });

  test("shows tracklist with 2 tracks", async ({ page }) => {
    await expect(page.getByText(/Tracklist/i)).toBeVisible();
    // Use exact:true to avoid "Moonwave I" matching inside "Moonwave II"
    await expect(page.getByText("Moonwave I", { exact: true })).toBeVisible();
    await expect(page.getByText("Moonwave II", { exact: true })).toBeVisible();
  });

  test("shows track durations", async ({ page }) => {
    await expect(page.getByText("4:05")).toBeVisible();
    await expect(page.getByText("5:12")).toBeVisible();
  });

  test("shows Credits section", async ({ page }) => {
    await expect(page.getByText("Credits")).toBeVisible();
  });

  test("shows linked Creative Experience (Moonwave Experience)", async ({ page }) => {
    await expect(page.getByText("Creative Experience")).toBeVisible();
    await expect(page.getByText("Moonwave Experience")).toBeVisible();
  });

  test("shows linked Campaign", async ({ page }) => {
    await expect(page.getByText("Moonwave Fan Artwork")).toBeVisible();
  });

  test("does NOT show a play button (no real audio)", async ({ page }) => {
    await expect(page.getByText(/audio preview not available/i)).toBeVisible();
    const playBtn = page.getByRole("button", { name: /^play$/i });
    await expect(playBtn).toHaveCount(0);
  });

  test("campaign entry is marked as Phase 2", async ({ page }) => {
    const phase2Texts = page.getByText(/Phase 2/, { exact: false });
    await expect(phase2Texts.first()).toBeVisible();
  });

  test("navigates back to explore", async ({ page }) => {
    const backLink = page.getByRole("link", { name: /Back to Explore/i });
    await expect(backLink).toBeVisible();
    await backLink.click();
    await expect(page).toHaveURL("/explore");
  });

  test("returns 404 for unknown release id", async ({ page }) => {
    await page.goto("/releases/rel_does_not_exist");
    const body = await page.textContent("body");
    expect(body).toMatch(/404|not found/i);
  });
});

test.describe("Full navigation flow", () => {
  test("Home → Explore → Freefallers Profile → Moonwave EP Detail", async ({ page }) => {
    // 1. Home
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "AII" })).toBeVisible();

    // 2. Navigate to Explore via Navbar
    await page.getByRole("link", { name: "Explore" }).first().click();
    await expect(page).toHaveURL("/explore");
    await expect(page.getByRole("heading", { name: /explore/i })).toBeVisible();

    // 3. Click Freefallers artist card
    await results(page).getByRole("link", { name: "Freefallers", exact: true }).click();
    await expect(page).toHaveURL("/artists/freefallers");
    await expect(page.getByRole("heading", { name: /Freefallers/i })).toBeVisible();

    // 4. Click Moonwave EP from Discography
    await page.getByRole("link", { name: /Moonwave EP/i }).first().click();
    await expect(page).toHaveURL("/releases/rel_001");
    await expect(page.getByRole("heading", { name: /MOONWAVE EP/i })).toBeVisible();

    // 5. Verify Campaign Preview is shown but clearly marked as Phase 2 (not yet linked)
    await expect(page.getByText("Moonwave Fan Artwork")).toBeVisible();
    await expect(page.getByText(/Phase 2/, { exact: false }).first()).toBeVisible();
  });
});

test.describe("Responsive — 375px mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("Home hero renders on mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "AII" })).toBeVisible();
  });

  test("Explore page renders on mobile", async ({ page }) => {
    await page.goto("/explore");
    await expect(page.getByRole("heading", { name: /explore/i })).toBeVisible();
    await expect(page.getByRole("searchbox")).toBeVisible();
    await expect(page.getByRole("button", { name: /artists/i })).toBeVisible();
  });

  test("Artist profile renders on mobile", async ({ page }) => {
    await page.goto("/artists/freefallers");
    await expect(page.getByRole("heading", { name: /Freefallers/i })).toBeVisible();
    await expect(page.getByText("12.4K")).toBeVisible();
  });

  test("Release detail renders on mobile", async ({ page }) => {
    await page.goto("/releases/rel_001");
    await expect(page.getByRole("heading", { name: /MOONWAVE EP/i })).toBeVisible();
    // Use exact:true to avoid partial match between "Moonwave I" and "Moonwave II"
    await expect(page.getByText("Moonwave I", { exact: true })).toBeVisible();
  });
});

test.describe("2026-11-18 additions", () => {
  test("top nav has a Stage link to the live-stage index", async ({ page }, info) => {
    test.skip(info.project.name.includes("mobile"), "desktop nav");
    await page.goto("/");
    const stage = page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Stage" });
    await expect(stage).toHaveAttribute("href", "/stage");
    await stage.click();
    await expect(page).toHaveURL("/stage");
    await expect(page.getByRole("heading", { name: "Step onto the stage" })).toBeVisible();
    await expect(stage).toHaveAttribute("aria-current", "page");
  });

  test("Home hero artwork is labelled platform art and parks its playhead under reduced motion", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.getByText("AII platform artwork")).toBeVisible();
    const anim = await page.locator(".aii-playhead").evaluate((el) => getComputedStyle(el).animationName);
    expect(anim).toBe("none");
    await ctx.close();
  });

  test("Home playhead animates when motion is allowed", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "no-preference" });
    const page = await ctx.newPage();
    await page.goto("/");
    expect(await page.locator(".aii-playhead").evaluate((el) => getComputedStyle(el).animationName)).toBe("aii-sweep");
    await ctx.close();
  });

  test("Explore empty state offers a reset that restores results", async ({ page }) => {
    await page.goto("/explore");
    await page.getByRole("searchbox").fill("zzznomatch999");
    await page.getByRole("button", { name: "Clear search and filters" }).click();
    await expect(page.getByRole("searchbox")).toHaveValue("");
    await expect(results(page).getByRole("heading", { name: "Freefallers" })).toBeVisible();
  });

  test("dates render in English regardless of browser locale", async ({ browser }) => {
    const ctx = await browser.newContext({ locale: "ko-KR", timezoneId: "Asia/Seoul" });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.getByText(/September 15, 2026/).first()).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/\d{4}년/);
    await ctx.close();
  });
});
