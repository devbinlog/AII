import { test, expect, type Page } from "@playwright/test";

/**
 * The experience page is server-rendered. Its "Start Experience" button used to be
 * live-looking before React hydrated (and before the scene runtime existed), so an
 * early click did nothing and the fan stayed on the pre-play overlay. It must be
 * natively disabled until a click actually starts playback.
 * JS is delayed to hold that window open, as in studio-hydration.spec.ts.
 */
const CAMPAIGN_SLUG = "moonwave-fan-artwork";
const EXPERIENCE = `/campaigns/${CAMPAIGN_SLUG}/experience`;

async function delayScripts(page: Page, ms = 2500) {
  await page.route("**/_next/static/**/*.js", async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

const start = (page: Page) => page.getByRole("button", { name: /Start Experience/i });
const createLink = (page: Page) => page.getByRole("link", { name: /Create Artwork/i });

test.describe("Fan Experience before hydration", () => {
  test.beforeEach(({}, info) => {
    test.skip(
      info.project.name !== "edge" && info.project.name !== "mobile-edge",
      "server-render timing check; desktop and mobile Edge cover it",
    );
  });

  test("Start Experience is disabled until a click can start playback, then enabled", async ({ page }) => {
    await delayScripts(page);
    await page.goto(EXPERIENCE, { waitUntil: "commit" });
    await start(page).waitFor({ state: "attached", timeout: 20000 });
    await expect(start(page)).toBeDisabled();
    await expect(start(page)).toBeEnabled({ timeout: 30000 });
  });

  test("an early click does not leave the page in a wrong state; the next click starts", async ({ page }, info) => {
    await delayScripts(page);
    await page.goto(EXPERIENCE, { waitUntil: "commit" });
    await start(page).waitFor({ state: "visible", timeout: 20000 });

    // A real pointer press on the server-rendered button, before any JS has run.
    const box = (await start(page).boundingBox())!;
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    if (info.project.name === "mobile-edge") await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);

    // Once interactive, the fan is still on the pre-play overlay (not half-started),
    // and the click now works.
    await expect(start(page)).toBeEnabled({ timeout: 30000 });
    await expect(createLink(page)).toHaveCount(0);
    await start(page).click();
    await expect(createLink(page)).toBeVisible();
    await expect(start(page)).toHaveCount(0);
  });

  test("double click starts once and plays (does not toggle back to paused)", async ({ page }) => {
    await page.goto(EXPERIENCE);
    await expect(start(page)).toBeEnabled({ timeout: 30000 });
    await start(page).dblclick();
    await expect(createLink(page)).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^Pause/ })).toBeVisible();
  });

  test("Create Artwork opens the Fan Creator once; coming back resets the overlay", async ({ page }) => {
    const creatorLoads: string[] = [];
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame() && new URL(f.url()).pathname.endsWith("/create")) creatorLoads.push(f.url());
    });
    await delayScripts(page, 1500);
    await page.goto(EXPERIENCE, { waitUntil: "commit" });
    await start(page).click({ timeout: 30000 }); // waits until it is enabled
    await expect(createLink(page)).toHaveAttribute("href", `/campaigns/${CAMPAIGN_SLUG}/create`);
    await createLink(page).click();
    await expect(page).toHaveURL(new RegExp(`/campaigns/${CAMPAIGN_SLUG}/create$`));
    expect(creatorLoads).toHaveLength(1);

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${EXPERIENCE}$`));
    await expect(start(page)).toBeEnabled({ timeout: 30000 });
    await expect(createLink(page)).toHaveCount(0);
  });
});
