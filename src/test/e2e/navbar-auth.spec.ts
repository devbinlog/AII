import { test, expect, type Page } from "@playwright/test";

async function uiSignIn(page: Page, email: string, redirect = "/") {
  await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("demo");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

const isMobile = (name: string) => name.includes("mobile");

async function openMobileMenu(page: Page) {
  await page.getByRole("button", { name: "Open menu" }).click();
  return page.getByRole("navigation", { name: "Mobile navigation" });
}

test.describe("Navbar reflects the session", () => {
  test("anonymous: Sign in only, no Studio or account menu", async ({ page }, info) => {
    await page.goto("/explore");
    if (isMobile(info.project.name)) {
      const menu = await openMobileMenu(page);
      await expect(menu.getByRole("link", { name: "Sign in" })).toBeVisible();
      await expect(menu.getByRole("link", { name: "Studio" })).toHaveCount(0);
    } else {
      const signIn = page.getByRole("banner").getByRole("link", { name: "Sign in" });
      await expect(signIn).toBeVisible();
      await expect(signIn).toHaveAttribute("href", "/login?redirect=%2Fexplore");
      await expect(page.getByRole("banner").getByRole("link", { name: "Studio" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Account menu/ })).toHaveCount(0);
    }
  });

  test("fan: My Artworks + account menu, survives reload, sign out updates immediately", async ({ page }, info) => {
    await uiSignIn(page, "fan1@example.com", "/explore");
    if (isMobile(info.project.name)) {
      let menu = await openMobileMenu(page);
      await expect(menu.getByText("Alex Kim")).toBeVisible();
      await expect(menu.getByRole("link", { name: "My Artworks" })).toBeVisible();
      await expect(menu.getByRole("link", { name: "Studio" })).toHaveCount(0);
      await page.keyboard.press("Escape");
      await page.reload();
      menu = await openMobileMenu(page);
      await expect(menu.getByText("Alex Kim")).toBeVisible();
      await menu.getByRole("button", { name: "Sign out" }).click();
      menu = await openMobileMenu(page);
      await expect(menu.getByRole("link", { name: "Sign in" })).toBeVisible();
    } else {
      const banner = page.getByRole("banner");
      await expect(banner.getByRole("link", { name: "My Artworks" })).toBeVisible();
      await expect(banner.getByRole("link", { name: "Studio" })).toHaveCount(0);
      await page.reload();
      const trigger = page.getByRole("button", { name: /Account menu for Alex Kim/ });
      await expect(trigger).toBeVisible();
      // Keyboard-accessible menu
      await trigger.focus();
      await page.keyboard.press("Enter");
      const menu = page.getByRole("menu");
      await expect(menu).toBeVisible();
      await expect(menu.getByText("fan1@example.com")).toBeVisible();
      await expect(menu.getByRole("menuitem", { name: "Artist Studio" })).toHaveCount(0);
      await menu.getByRole("menuitem", { name: "Sign out" }).click();
      await expect(banner.getByRole("link", { name: "Sign in" })).toBeVisible();
      await expect(trigger).toHaveCount(0);
    }
    // Server session is gone, not just the UI
    expect((await page.request.get("/api/me/artworks")).status()).toBe(401);
  });

  test("artist admin: Studio entry; signing out of Studio leaves the protected page", async ({ page }, info) => {
    test.skip(isMobile(info.project.name), "desktop menu path");
    await uiSignIn(page, "studio@freefallers.com", "/studio");
    const banner = page.getByRole("banner");
    await expect(banner.getByRole("link", { name: "Studio" })).toBeVisible();
    await page.getByRole("button", { name: /Account menu for Freefallers Studio/ }).click();
    await expect(page.getByRole("menuitem", { name: "Artist Studio" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/");
    await expect(banner.getByRole("link", { name: "Sign in" })).toBeVisible();
    expect((await page.request.get("/api/studio/scenes")).status()).toBe(401);
  });

  test("a copied session cookie stops working after sign out", async ({ page, browser }) => {
    await page.request.post("/api/auth/signin", { data: { email: "fan1@example.com", password: "x" } });
    const cookie = (await page.context().cookies()).find((c) => c.name === "aii_session")!;
    await page.request.post("/api/auth/signout");
    const other = await browser.newContext();
    await other.addCookies([{ ...cookie }]);
    expect((await other.request.get("/api/me/artworks")).status()).toBe(401);
    await other.close();
  });
});
