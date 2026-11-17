import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

/**
 * Stage: artist publish workflow → public read-only viewer.
 * Publication state is shared server-wide, so state-changing tests run serially in one project.
 */

interface StageState {
  view: string;
  camera: { position: [number, number, number]; target: [number, number, number] } | null;
  items: { id: string; p: [number, number, number] }[];
}

const readState = (page: Page): Promise<StageState> =>
  page.getByTestId("stage-state").evaluate((el) => {
    const d = (el as HTMLElement).dataset;
    return { view: d.view ?? "", camera: d.camera ? JSON.parse(d.camera) : null, items: JSON.parse(d.items ?? "[]") };
  });
const posOf = async (page: Page, id: string) => (await readState(page)).items.find((i) => i.id === id)!.p;

async function signIn(request: APIRequestContext, email: string) {
  expect((await request.post("/api/auth/signin", { data: { email, password: "demo" } })).ok()).toBe(true);
}

async function waitForCanvas(page: Page) {
  await expect(page.getByTestId("stage-viewport").locator("canvas")).toBeVisible({ timeout: 20000 });
  await expect.poll(async () => (await readState(page)).camera !== null, { timeout: 10000 }).toBe(true);
}

/** Make sure a published stage exists (API, as artist admin) without touching the UI under test. */
async function ensurePublished(request: APIRequestContext) {
  await signIn(request, "studio@freefallers.com");
  const draft = (await (await request.get("/api/studio/stage")).json()) as { layout: unknown };
  await request.put("/api/studio/stage", { data: draft.layout });
  expect((await request.post("/api/studio/stage/publish")).status()).toBe(201);
}

test.describe("Stage publish workflow (serial)", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "edge", "publication state is global; run once");
  });

  test("D + F: draft is not public; unpublished stage is closed; profile CTA hidden", async ({ page, request }) => {
    await signIn(request, "studio@freefallers.com");
    await request.delete("/api/studio/stage/publish");
    expect((await page.goto("/artists/freefallers/stage"))?.status()).toBe(404);
    expect((await request.get("/api/artists/freefallers/stage")).status()).toBe(404);
    await page.goto("/artists/freefallers");
    await expect(page.getByRole("link", { name: /Enter the 3D stage/ })).toHaveCount(0);
  });

  test("A + G: admin arranges, saves, publishes → fan sees the same coordinates; profile CTA appears", async ({ page, browser }) => {
    await signIn(page.request, "studio@freefallers.com");
    await page.goto("/studio/stage");
    await waitForCanvas(page);

    // Start from a saved default draft so the next move is always an unsaved change
    await page.getByRole("button", { name: "Default layout" }).click();
    const save = page.getByRole("button", { name: "Save layout" });
    if (await save.isEnabled()) {
      await save.click();
      await expect(page.getByRole("status")).toContainText("Layout saved");
    }
    await page.getByRole("button", { name: /^Keyboard/ }).click();
    await page.getByRole("button", { name: "Move downstage" }).click();
    await page.getByRole("button", { name: "Move downstage" }).click();
    const arranged = await posOf(page, "keyboard");
    expect(arranged).toEqual([-4.25, 0, -0.25]);

    // Unsaved changes cannot be published
    await expect(page.getByText("Unsaved changes")).toBeVisible();
    await expect(page.getByRole("button", { name: /Publish (stage|new version)/ })).toBeDisabled();
    await page.getByRole("button", { name: "Save layout" }).click();
    await expect(page.getByRole("status")).toContainText("Layout saved");
    await page.getByRole("button", { name: /Publish (stage|new version)/ }).click();
    await expect(page.getByRole("status")).toContainText(/Published stage v\d+/);

    // G: reconnect (reload) keeps the saved coordinates
    await page.reload();
    await waitForCanvas(page);
    expect(await posOf(page, "keyboard")).toEqual(arranged);

    // Fan (anonymous) viewer shows the published coordinates
    const fanCtx = await browser.newContext();
    const fan = await fanCtx.newPage();
    await fan.goto("/artists/freefallers");
    await fan.getByRole("link", { name: /Enter the 3D stage/ }).click();
    await expect(fan).toHaveURL(/\/artists\/freefallers\/stage$/);
    await waitForCanvas(fan);
    expect(await posOf(fan, "keyboard")).toEqual(arranged);
    await expect(fan.getByRole("heading", { level: 1, name: "Freefallers" })).toBeVisible();

    // Read-only: no editing controls, and the Studio save API refuses anonymous fans
    await expect(fan.getByRole("button", { name: /Save layout|Move downstage|Publish/ })).toHaveCount(0);
    expect((await fan.request.put("/api/studio/stage", { data: {} })).status()).toBe(401);
    await fanCtx.close();
  });

  test("E: editing the draft after publishing does not change the public stage", async ({ page, browser }) => {
    const fanCtx = await browser.newContext();
    const fan = await fanCtx.newPage();
    await fan.goto("/artists/freefallers/stage");
    await waitForCanvas(fan);
    const publicBefore = await posOf(fan, "member-bass");

    await signIn(page.request, "studio@freefallers.com");
    await page.goto("/studio/stage");
    await waitForCanvas(page);
    await page.getByRole("button", { name: /^Bass\s*performer$/i }).click();
    await page.getByRole("button", { name: "Move stage left" }).click();
    await page.getByRole("button", { name: "Save layout" }).click();
    await expect(page.getByRole("status")).toContainText("Layout saved");
    expect(await posOf(page, "member-bass")).not.toEqual(publicBefore);

    await fan.reload();
    await waitForCanvas(fan);
    expect(await posOf(fan, "member-bass")).toEqual(publicBefore);
    await fanCtx.close();
  });

  test("B + C: editor sees no publish button and gets 403; fan gets 403 on Studio APIs", async ({ page, browser }) => {
    await signIn(page.request, "editor@freefallers.com");
    await page.goto("/studio/stage");
    await waitForCanvas(page);
    await expect(page.getByText("An artist admin publishes the stage.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Publish/ })).toHaveCount(0);
    expect((await page.request.post("/api/studio/stage/publish")).status()).toBe(403);
    expect((await page.request.delete("/api/studio/stage/publish")).status()).toBe(403);

    const fanCtx = await browser.newContext();
    await signIn(fanCtx.request, "fan1@example.com");
    expect((await fanCtx.request.put("/api/studio/stage", { data: {} })).status()).toBe(403);
    expect((await fanCtx.request.post("/api/studio/stage/publish")).status()).toBe(403);
    await fanCtx.close();
  });

  test("F: unpublish from Studio closes the fan viewer", async ({ page, browser }) => {
    await signIn(page.request, "studio@freefallers.com");
    await page.goto("/studio/stage");
    await waitForCanvas(page);
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByRole("status")).toContainText("Stage unpublished");

    const fanCtx = await browser.newContext();
    const fan = await fanCtx.newPage();
    expect((await fan.goto("/artists/freefallers/stage"))?.status()).toBe(404);
    await fanCtx.close();

    // Leave the stage published for the viewer tests
    await ensurePublished(page.request);
  });
});

/**
 * Viewer tests never change publication state (that would race the serial workflow
 * in another worker); they wait until a published stage is available.
 */
async function openPublishedStage(page: Page) {
  // The serial workflow briefly unpublishes; retry until the page itself is served.
  await expect
    .poll(async () => (await page.goto("/artists/freefallers/stage"))?.status(), { timeout: 90000, intervals: [1000] })
    .toBe(200);
  await waitForCanvas(page);
}

test.describe("Public stage viewer", () => {
  test.describe.configure({ timeout: 150000 });

  test("H: camera starts at stage center; views, orbit, zoom, reset", async ({ page }, info) => {
    test.skip(info.project.name.includes("mobile"), "desktop pointer");
    await openPublishedStage(page);
    expect((await readState(page)).camera!.target).toEqual([0, 0.8, 0]);

    for (const [name, check] of [
      ["Top", (c: StageState["camera"]) => c!.position[1] > 15.9],
      ["Front", (c: StageState["camera"]) => c!.position[2] > 13.9],
      ["Side", (c: StageState["camera"]) => c!.position[0] > 13.9],
    ] as const) {
      await page.getByRole("button", { name, exact: true }).click();
      await expect.poll(async () => check((await readState(page)).camera), { timeout: 10000 }).toBe(true);
    }

    const box = (await page.getByTestId("stage-viewport").locator("canvas").boundingBox())!;
    const before = JSON.stringify((await readState(page)).camera);
    await page.mouse.move(box.x + 30, box.y + 30);
    await page.mouse.down();
    await page.mouse.move(box.x + 230, box.y + 60, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => JSON.stringify((await readState(page)).camera)).not.toBe(before);
    // Pan (right button)
    const beforePan = (await readState(page)).camera!.target;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 40, { steps: 8 });
    await page.mouse.up({ button: "right" });
    await expect.poll(async () => JSON.stringify((await readState(page)).camera!.target)).not.toBe(JSON.stringify(beforePan));
    // Zoom
    await page.mouse.wheel(0, -600);
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: "Reset camera" }).click();
    await expect.poll(async () => (await readState(page)).camera, { timeout: 10000 }).toEqual({ position: [0, 6.5, 11.5], target: [0, 0.8, 0] });

    // Member info
    await page.getByRole("button", { name: "Vocal", exact: true }).click();
    await expect(page.getByText("Hologram band member")).toBeVisible();
  });

  test("I: touch device — one-finger orbit works, layout fits, items cannot be dragged", async ({ page }, info) => {
    test.skip(!info.project.name.includes("mobile"), "touch only");
    await openPublishedStage(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const itemsBefore = JSON.stringify((await readState(page)).items);
    const camBefore = JSON.stringify((await readState(page)).camera);
    const box = (await page.getByTestId("stage-viewport").locator("canvas").boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const at = (x: number, y: number) => [{ x, y, id: 1 }];
    const sx = box.x + box.width / 2;
    const sy = box.y + box.height * 0.6; // across the stage, likely over members
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(sx, sy) });
    for (let i = 1; i <= 10; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(sx + i * 12, sy) });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(500);
    expect(JSON.stringify((await readState(page)).items)).toBe(itemsBefore);
    expect(JSON.stringify((await readState(page)).camera)).not.toBe(camBefore);
  });

  test("WebGL unavailable → fallback and lineup still listed", async ({ browser }, info) => {
    test.skip(info.project.name !== "edge", "one browser is enough");
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      // @ts-expect-error test override
      HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
        if (typeof type === "string" && type.startsWith("webgl")) return null;
        return orig.call(this, type as "2d", ...(rest as []));
      };
    });
    const page = await ctx.newPage();
    await expect
      .poll(async () => (await page.request.get("/api/artists/freefallers/stage")).status(), { timeout: 90000, intervals: [1000] })
      .toBe(200);
    await page.goto("/artists/freefallers/stage");
    await expect(page.getByText(/can.t be shown in this browser/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Vocal", exact: true })).toBeVisible();
    await ctx.close();
  });
});
