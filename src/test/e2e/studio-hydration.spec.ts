import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * Studio editors are server-rendered. Before React hydrates, their controls must be
 * natively disabled (HydrationGate) instead of looking usable and dropping the input,
 * and they must unlock once the page is interactive. JS is delayed to open that window.
 */
const EDITORS: { path: string; control: (page: Page) => Locator }[] = [
  { path: "/studio/scenes/scn_001", control: (p) => p.getByRole("tab", { name: /Interactions/ }) },
  { path: "/studio/releases/rel_001", control: (p) => p.getByRole("button", { name: "Add track" }) },
  { path: "/studio/experiences/exp_001", control: (p) => p.getByLabel("Title") },
  { path: "/studio/campaigns/cmp_001", control: (p) => p.getByLabel("Title") },
  { path: "/studio/releases", control: (p) => p.getByRole("button", { name: "Create draft" }) },
  { path: "/studio/media", control: (p) => p.getByRole("button", { name: "Choose files" }) },
  { path: "/studio/stage", control: (p) => p.getByRole("button", { name: "Top", exact: true }) },
];

test.describe("Studio editors before hydration", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "edge", "server-render timing check; one browser is enough");
  });

  for (const { path, control } of EDITORS) {
    test(`${path}: controls disabled until interactive, then enabled`, async ({ page }) => {
      await page.request.post("/api/auth/signin", { data: { email: "studio@freefallers.com", password: "demo" } });
      await page.route("**/_next/static/**/*.js", async (route) => {
        await new Promise((r) => setTimeout(r, 2500));
        await route.continue();
      });
      await page.goto(path, { waitUntil: "commit" });
      const el = control(page);
      await el.waitFor({ state: "attached", timeout: 20000 });
      await expect(el).toBeDisabled();
      await expect(el).toBeEnabled({ timeout: 30000 });
    });
  }

  test("scene editor: a tab picked right after load opens its panel", async ({ page }) => {
    await page.request.post("/api/auth/signin", { data: { email: "studio@freefallers.com", password: "demo" } });
    await page.route("**/_next/static/**/*.js", async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
    await page.goto("/studio/scenes/scn_001", { waitUntil: "commit" });
    await page.getByRole("tab", { name: /Interactions/ }).click({ timeout: 30000 }); // waits until it works
    await expect(page.getByRole("tab", { name: /Interactions/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText(/after playback starts/i).first()).toBeAttached();
  });
});
