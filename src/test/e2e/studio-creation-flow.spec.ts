import { test, expect, type Page } from "@playwright/test";

/**
 * WS-08 Artist Studio creation flow (MOCK_ONLY): production-flow guidance,
 * save state + leave protection, server readiness, draft preview, and context
 * carried between Release → Experience → Campaign. Writes only new, uniquely
 * named drafts; never publishes shared fixtures.
 */

async function signIn(page: Page, email: string) {
  const res = await page.request.post("/api/auth/signin", { data: { email, password: "demo" } });
  expect(res.ok()).toBe(true);
}

async function createExperience(page: Page, title: string): Promise<string> {
  const res = await page.request.post("/api/studio/experiences", { data: { title } });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { experience: { id: string } }).experience.id;
}

const STEP_TIMEOUT = 15_000; // cold route compiles on the dev server

test.describe("Production flow", () => {
  test("dashboard shows every step, the next action, and the independent stage", async ({ page }) => {
    await signIn(page, "studio@freefallers.com");
    await page.goto("/studio");
    const flow = page.getByRole("region", { name: "Production flow" });
    await expect(flow).toBeVisible();
    for (const step of ["Identity", "Release", "Scene", "Experience", "Campaign"]) {
      await expect(flow.getByRole("link", { name: new RegExp(`^\\d\\. ${step}:`) })).toBeVisible();
    }
    await expect(flow.getByText(/3D Stage publishes on its own/)).toBeVisible();
  });
});

test.describe("Experience editor — save state, readiness, preview", () => {
  test("unsaved edits are flagged and protected; saved drafts are checked and previewed", async ({ page }) => {
    await signIn(page, "studio@freefallers.com");
    const title = `E2E WS08 ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const id = await createExperience(page, title);
    await page.goto(`/studio/experiences/${id}`);

    await expect(page.getByText("All changes saved")).toBeVisible();
    // Server readiness: an empty experience cannot be published.
    await expect(page.getByText(/issue.* block publishing/)).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(page.getByText("Add at least one scene before publishing").first()).toBeVisible();

    await page.getByLabel("Title").fill(`${title} (edited)`);
    await expect(page.getByText("Unsaved changes")).toBeVisible();

    // Leaving through the Studio sidebar asks first; dismissing keeps the edit.
    const scenesLink = page.getByRole("navigation", { name: "Studio" }).getByRole("link", { name: "Scenes" });
    page.once("dialog", (d) => void d.dismiss());
    await scenesLink.click();
    await expect(page).toHaveURL(new RegExp(`/studio/experiences/${id}$`));
    await expect(page.getByLabel("Title")).toHaveValue(`${title} (edited)`);

    // Accepting leaves without saving.
    page.once("dialog", (d) => void d.accept());
    await scenesLink.click();
    await expect(page).toHaveURL(/\/studio\/scenes$/);
    await page.goto(`/studio/experiences/${id}`);
    await expect(page.getByLabel("Title")).toHaveValue(title);

    // Add a fixture scene, save, and the server now reports it ready.
    const addScene = page.getByLabel("Add scene");
    const firstScene = (await addScene.locator("option").nth(1).textContent())!.trim();
    await addScene.selectOption({ label: firstScene });
    await expect(page.getByText("Unsaved changes")).toBeVisible();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("status")).toContainText("Draft saved", { timeout: STEP_TIMEOUT });
    await expect(page.getByText("All changes saved")).toBeVisible();
    await expect(page.getByText("Ready to publish")).toBeVisible({ timeout: STEP_TIMEOUT });

    // Draft preview renders the saved sequence, owner-only, clearly not public.
    await page.getByRole("link", { name: "Preview saved draft" }).click();
    await expect(page).toHaveURL(new RegExp(`/studio/experiences/${id}/preview$`), { timeout: STEP_TIMEOUT });
    await expect(page.getByText(/Draft preview — fans do not see this/)).toBeVisible();
    await expect(page.getByText(firstScene, { exact: true }).first()).toBeVisible();
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Ready to publish as v1.0.0")).toBeVisible();
  });

  test("publish review can be cancelled and nothing is published", async ({ page }) => {
    await signIn(page, "studio@freefallers.com");
    const id = await createExperience(page, `E2E WS08 cancel ${Date.now()}`);
    await page.goto(`/studio/experiences/${id}`);
    await page.getByRole("button", { name: /Save & publish new version/ }).click();
    const heading = page.getByRole("heading", { name: "Publish v1.0.0?" });
    await expect(heading).toBeVisible({ timeout: STEP_TIMEOUT });
    await expect(heading).toBeFocused();
    // Blocked by the server's readiness: the confirm button stays disabled.
    await expect(page.getByRole("button", { name: "Publish v1.0.0" })).toBeDisabled();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(heading).toHaveCount(0);
    const res = await page.request.get(`/api/studio/experiences/${id}`);
    expect(((await res.json()) as { versions: unknown[] }).versions).toHaveLength(0);
  });
});

test.describe("Draft preview access", () => {
  test("anonymous visitors go to login; fans are refused; API readiness is private", async ({ page }) => {
    await page.goto("/studio/experiences/exp_001/preview");
    await expect(page).toHaveURL(/\/login\?redirect=/);

    await signIn(page, "fan1@example.com");
    await page.goto("/studio/experiences/exp_001/preview");
    await expect(page.getByRole("heading", { name: /don.t have access to Artist Studio/i })).toBeVisible();
    expect((await page.request.get("/api/studio/experiences/exp_001/publish")).status()).toBe(403);
  });
});

test.describe("Context between steps", () => {
  test("a release links to its experiences and starts a new one pre-linked", async ({ page }) => {
    await signIn(page, "studio@freefallers.com");
    await page.goto("/studio/releases/rel_001");
    await expect(page.getByRole("heading", { name: /Experiences for this release/ })).toBeVisible();
    await page.getByRole("link", { name: "New experience" }).click();
    await expect(page).toHaveURL(/\/studio\/experiences\?release=rel_001$/);
    await expect(page.getByLabel("Linked release")).toHaveValue("rel_001");
  });

  test("a campaign can start from a chosen experience; unknown ids are ignored", async ({ page }) => {
    await signIn(page, "studio@freefallers.com");
    await page.goto("/studio/campaigns?experience=exp_001");
    await expect(page.getByLabel("Experience")).toHaveValue("exp_001");
    await page.goto("/studio/campaigns?experience=exp_someone_else");
    await expect(page.getByLabel("Experience")).not.toHaveValue("exp_someone_else");
  });
});
