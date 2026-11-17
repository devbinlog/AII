import { test, expect, type Page } from "@playwright/test";

/**
 * WS-05 Artist Studio — E2E (MOCK_ONLY).
 * The mock store lives for the whole dev-server process, so every run uses unique names.
 */

async function signIn(page: Page, email: string) {
  const res = await page.request.post("/api/auth/signin", { data: { email, password: "demo" } });
  expect(res.ok()).toBe(true);
}

test.describe("Studio access control", () => {
  test("anonymous visitors are sent to login", async ({ page }) => {
    await page.goto("/studio");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fstudio/);
  });

  test("fans see a 403 page and the Studio API refuses them", async ({ page }) => {
    await signIn(page, "fan1@example.com");
    await page.goto("/studio");
    await expect(page.getByRole("heading", { name: /don.t have access to Artist Studio/i })).toBeVisible();
    const api = await page.request.get("/api/studio/scenes");
    expect(api.status()).toBe(403);
  });

  test("editors can open drafts but cannot publish", async ({ page }) => {
    await signIn(page, "editor@freefallers.com");
    await page.goto("/studio/experiences/exp_001");
    await expect(page.getByRole("button", { name: /Save draft/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /publish new version/i })).toHaveCount(0);
    await expect(page.getByText(/An artist admin publishes experiences/i)).toBeVisible();
    const res = await page.request.post("/api/studio/experiences/exp_001/publish");
    expect(res.status()).toBe(403);
  });
});

test.describe("Studio pages render", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "studio@freefallers.com");
  });

  for (const [path, heading] of [
    ["/studio", "Freefallers"],
    ["/studio/identity", "Artist identity"],
    ["/studio/releases", "Release manager"],
    ["/studio/media", "Media manager"],
    ["/studio/scenes", "Scene library"],
    ["/studio/experiences", "Experiences"],
    ["/studio/campaigns", "Campaign builder"],
    ["/studio/analytics", "Moonwave Fan Artwork"],
  ] as const) {
    test(`${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    });
  }

  test("scene editor shows preview canvas and layers", async ({ page }) => {
    await page.goto("/studio/scenes/scn_001");
    await expect(page.locator("canvas").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Main Waveform/ })).toBeVisible();
    await page.getByRole("tab", { name: /Interactions/ }).click();
    await expect(page.getByText(/after playback starts/i).first()).toBeAttached();
  });
});

test.describe("Artist creates, publishes, and fans experience it", () => {
  test("scene → experience → publish → campaign → fan view", async ({ page, browser }, testInfo) => {
    test.slow();
    const id = `${Date.now().toString(36)}${testInfo.project.name.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;
    const sceneName = `E2E Scene ${id}`;
    const experienceTitle = `E2E Experience ${id}`;
    const campaignTitle = `E2E Campaign ${id}`;
    const paramLabel = `Headline ${id}`;

    await signIn(page, "studio@freefallers.com");

    // 1. Scene
    await page.goto("/studio/scenes");
    await page.getByLabel("Scene name").fill(sceneName);
    await page.getByRole("button", { name: "Create scene" }).click();
    await expect(page).toHaveURL(/\/studio\/scenes\/scn_/);
    await page.getByRole("button", { name: "+ Waveform" }).click();
    await page.getByRole("button", { name: "+ Text" }).click();
    await page.getByLabel("Text", { exact: true }).fill("Live from Studio");

    // 2. Interaction
    await page.getByRole("tab", { name: /Interactions/ }).click();
    await page.getByRole("button", { name: "Add mapping" }).click();
    await expect(page.getByRole("listitem", { name: /Mapping 1/ })).toBeVisible();

    await page.getByRole("button", { name: "Save scene" }).click();
    await expect(page.getByRole("status")).toContainText("Saved");

    // 3. Experience
    await page.goto("/studio/experiences");
    await page.getByLabel("Title").fill(experienceTitle);
    await page.getByRole("button", { name: "Create experience" }).click();
    await expect(page).toHaveURL(/\/studio\/experiences\/exp_/);
    await page.getByLabel("Add scene").selectOption({ label: sceneName });
    await page.getByRole("button", { name: "Add parameter" }).click();
    const param = page.getByRole("listitem").filter({ has: page.getByLabel("Label") }).first();
    await param.getByLabel("Label").fill(paramLabel);
    await page.getByRole("button", { name: /Save & publish new version/ }).click();
    await expect(page.getByRole("status")).toContainText("Published v1.0.0");

    // 4. Campaign
    await page.goto("/studio/campaigns");
    await page.getByLabel("Title").fill(campaignTitle);
    const slug = await page.getByLabel("Address").inputValue();
    expect(slug).toMatch(/^e2e-campaign-/);
    await page.getByLabel("Experience").selectOption({ label: experienceTitle });
    await page.getByRole("button", { name: "Create draft campaign" }).click();
    await expect(page).toHaveURL(/\/studio\/campaigns\/cmp_/);

    // Draft is not public yet
    const anon = await browser.newContext();
    const fan = await anon.newPage();
    expect((await fan.goto(`/campaigns/${slug}`))?.status()).toBe(404);

    await page.getByRole("button", { name: /Save & go live/ }).click();
    await expect(page.getByRole("status")).toContainText("Campaign is live");

    // 5. Fan view (anonymous)
    await fan.goto(`/campaigns/${slug}`);
    await expect(fan.getByRole("heading", { name: campaignTitle }).first()).toBeVisible();
    await fan.goto(`/campaigns/${slug}/experience`);
    await expect(fan.locator("canvas").first()).toBeVisible({ timeout: 8000 });
    await fan.getByRole("button", { name: /Start Experience/i }).click();
    await expect(fan.getByRole("link", { name: /Create Artwork/i })).toBeVisible();
    await fan.goto(`/campaigns/${slug}/create`);
    await expect(fan.getByText(paramLabel)).toBeVisible({ timeout: 8000 });
    await anon.close();
  });
});
