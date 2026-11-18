import { test, expect } from "@playwright/test";

/**
 * Studio → Identity brand kit. Edits stay unsaved: the artist's branding is shared
 * state other specs read (artist page heading), and saving is covered by the
 * studio contract tests.
 */
test.describe("Identity brand kit", () => {
  test.beforeEach(async ({ page }) => {
    await page.request.post("/api/auth/signin", { data: { email: "studio@freefallers.com", password: "demo" } });
    await page.goto("/studio/identity");
    // Controls unlock once the editor is interactive (no input is lost before hydration).
    await expect(page.getByLabel("Brand name")).toBeEnabled();
  });

  test("brand name, typeface and logo mark update the live preview", async ({ page }) => {
    const preview = page.getByTestId("brand-preview");
    await expect(preview.getByRole("img", { name: "Freefallers logo" })).toBeVisible();

    await page.getByLabel("Brand name").fill("FREE/FALLERS");
    await expect(preview.getByRole("img", { name: "FREE/FALLERS logo" })).toBeVisible();

    await page.getByText("Editorial Serif").click();
    await expect(page.getByRole("radio", { name: /Editorial Serif/ })).toBeChecked();
    const font = await preview.getByRole("img").evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font).toMatch(/Georgia/);

    await page.getByTitle("Circle").click();
    await page.getByLabel("Monogram").fill("FF");
    await expect(preview.locator("svg text")).toHaveText("FF");
  });

  test("no horizontal page overflow", async ({ page }) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
