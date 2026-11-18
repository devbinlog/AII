import { test, expect, type Page } from "@playwright/test";

/**
 * 3D Stage Configurator E2E. Needs WebGL (system Edge/Chrome provide it via SwiftShader headless).
 * Positions are read from the configurator's hidden [data-testid=stage-state] element.
 */

interface StageState {
  view: string;
  camera: { position: [number, number, number]; target: [number, number, number] } | null;
  items: { id: string; p: [number, number, number]; r: number }[];
}

async function readState(page: Page): Promise<StageState> {
  return page.getByTestId("stage-state").evaluate((el) => {
    const d = (el as HTMLElement).dataset;
    return { view: d.view ?? "", camera: d.camera ? JSON.parse(d.camera) : null, items: JSON.parse(d.items ?? "[]") };
  });
}
const pos = async (page: Page, id: string) => (await readState(page)).items.find((i) => i.id === id)!.p;

async function openStage(page: Page) {
  await page.request.post("/api/auth/signin", { data: { email: "studio@freefallers.com", password: "demo" } });
  await page.goto("/studio/stage");
  await expect(page.getByTestId("stage-viewport").locator("canvas")).toBeVisible({ timeout: 20000 });
  await expect.poll(async () => (await readState(page)).camera !== null, { timeout: 10000 }).toBe(true);
}

/** Switch to the plan view and wait until the camera animation has fully settled. */
async function topView(page: Page) {
  await page.getByRole("button", { name: "Top", exact: true }).click();
  await expect
    .poll(async () => {
      const c = (await readState(page)).camera;
      return !!c && c.position[1] >= 15.99 && Math.abs(c.position[0]) < 0.02;
    }, { timeout: 10000 })
    .toBe(true);
}

/** World (x, z) → page pixel for the top view (fov 45°, camera height 16, +Z down the screen). */
async function topViewMapper(page: Page) {
  // Touch/mouse input outside the visible viewport is not delivered.
  await page.getByTestId("stage-viewport").scrollIntoViewIfNeeded();
  const box = (await page.getByTestId("stage-viewport").locator("canvas").boundingBox())!;
  const visH = 2 * 16 * Math.tan((22.5 * Math.PI) / 180);
  const aspect = box.width / box.height;
  return (x: number, z: number) => ({ x: box.x + box.width / 2 + (x / (visH * aspect)) * box.width, y: box.y + box.height / 2 + (z / visH) * box.height });
}

async function mouseDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10);
  await page.mouse.up();
}

test.describe("3D Stage Configurator", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name.includes("mobile"), "desktop pointer tests; touch is covered below");
  });

  test("initial camera looks at stage center; views and reset", async ({ page }) => {
    await openStage(page);
    const s = await readState(page);
    expect(s.view).toBe("perspective");
    expect(s.camera!.target).toEqual([0, 0.8, 0]);
    expect(s.camera!.position[0]).toBe(0);

    await topView(page);
    for (const [name, axis] of [["Front", 2], ["Side", 0]] as const) {
      await page.getByRole("button", { name, exact: true }).click();
      await expect.poll(async () => (await readState(page)).camera!.position[axis], { timeout: 10000 }).toBeGreaterThan(13.9);
    }
    await page.getByRole("button", { name: "Reset camera" }).click();
    await expect.poll(async () => (await readState(page)).camera!.position, { timeout: 10000 }).toEqual([0, 6.5, 11.5]);
  });

  test("orbit and zoom change the camera within limits", async ({ page }) => {
    await openStage(page);
    const box = (await page.getByTestId("stage-viewport").locator("canvas").boundingBox())!;
    const before = (await readState(page)).camera!.position;
    await mouseDrag(page, { x: box.x + 40, y: box.y + 40 }, { x: box.x + 240, y: box.y + 70 });
    await expect.poll(async () => JSON.stringify((await readState(page)).camera!.position)).not.toBe(JSON.stringify(before));
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 800);
    await page.waitForTimeout(600);
    const { position, target } = (await readState(page)).camera!;
    const dist = Math.hypot(position[0] - target[0], position[1] - target[1], position[2] - target[2]);
    expect(dist).toBeLessThanOrEqual(28.5);
    expect(position[1]).toBeGreaterThan(0);
  });

  test("drag moves a member, drums stay locked, items stay on stage, undo/redo", async ({ page }) => {
    await openStage(page);
    // Other tests save drafts; start from the default arrangement (unsaved, local only).
    await page.getByRole("button", { name: "Default layout" }).click();
    await topView(page);
    const at = await topViewMapper(page);

    await mouseDrag(page, at(0, 1.75), at(2, 1.75));
    await expect.poll(() => pos(page, "member-vocal")).toEqual([2, 0, 1.75]);

    const cameraBefore = (await readState(page)).camera;
    await mouseDrag(page, at(0, -2.5), at(3, 0));
    expect(await pos(page, "drums")).toEqual([0, 0, -2.5]);
    await expect(page.getByText(/Locked in place/)).toBeVisible();
    // Pressing a locked item does not orbit the camera either
    expect((await readState(page)).camera).toEqual(cameraBefore);

    // Keyboard footprint is 0.7 m → clamped to (6 - 0.7, 4 - 0.7)
    await mouseDrag(page, at(4.25, -0.75), at(20, 20));
    await expect.poll(() => pos(page, "keyboard")).toEqual([5.3, 0, 3.3]);

    await page.getByRole("button", { name: "Undo" }).click();
    expect(await pos(page, "keyboard")).toEqual([4.25, 0, -0.75]);
    await page.getByRole("button", { name: "Redo" }).click();
    expect(await pos(page, "keyboard")).toEqual([5.3, 0, 3.3]);
  });

  test("keyboard and list controls move the selected item", async ({ page }) => {
    await openStage(page);
    await page.getByRole("button", { name: "Default layout" }).click();
    await page.getByRole("button", { name: /^Keyboard/ }).click();
    const start = await pos(page, "keyboard");
    await page.getByRole("button", { name: "Move downstage" }).click();
    expect((await pos(page, "keyboard"))[2]).toBeCloseTo(start[2] + 0.25);
    await page.keyboard.press("ArrowRight");
    expect((await pos(page, "keyboard"))[0]).toBeCloseTo(start[0] + 0.25);
    await page.getByRole("button", { name: /^Bass amp/ }).click();
    await expect(page.getByRole("group", { name: /Move Bass amp/ })).toHaveCount(0);
  });

  test("save and restore the layout", async ({ page }) => {
    await openStage(page);
    await page.getByRole("button", { name: /^Vocal mic/ }).click();
    await page.getByRole("button", { name: "Move stage left" }).click();
    const moved = await pos(page, "mic-vocal");
    await page.getByRole("button", { name: "Save layout" }).click();
    await expect(page.getByRole("status")).toContainText("Layout saved");

    await page.getByRole("button", { name: "Move stage left" }).click();
    expect(await pos(page, "mic-vocal")).not.toEqual(moved);
    await page.getByRole("button", { name: "Restore saved" }).click();
    await expect.poll(() => pos(page, "mic-vocal")).toEqual(moved);

    await page.reload();
    await expect.poll(() => pos(page, "mic-vocal"), { timeout: 15000 }).toEqual(moved);
  });
});

test.describe("3D Stage Configurator — layout & motion", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name.includes("mobile"), "desktop layout");
  });

  test("three-column editor: objects left, inspector right; focus mode hides panels; Esc exits", async ({ page }) => {
    await openStage(page);
    const objects = page.getByRole("complementary", { name: "Stage objects" });
    const inspector = page.getByRole("complementary", { name: "Inspector" });
    const viewport = page.getByTestId("stage-viewport");
    const [o, v, i] = await Promise.all([objects.boundingBox(), viewport.boundingBox(), inspector.boundingBox()]);
    expect(o!.x).toBeLessThan(v!.x);
    expect(i!.x).toBeGreaterThan(v!.x);
    await expect(objects.getByRole("button", { name: /^Keys\s*performer$/i })).toBeVisible();

    await page.getByRole("button", { name: "Focus" }).click();
    await expect(objects).toHaveCount(0);
    await expect(inspector).toHaveCount(0);
    expect((await viewport.boundingBox())!.width).toBeGreaterThan(v!.width);
    await page.keyboard.press("Escape");
    await expect(objects).toBeVisible();
  });

  test("labels toggle and locked state in the inspector", async ({ page }) => {
    await openStage(page);
    const labels = page.getByRole("button", { name: "Labels" });
    await expect(labels).toHaveAttribute("aria-pressed", "true");
    await labels.click();
    await expect(labels).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("complementary", { name: "Stage objects" }).getByRole("button", { name: /^Drum kit/ }).click();
    await expect(page.getByRole("complementary", { name: "Inspector" }).getByText(/Locked in place/)).toBeVisible();
  });

  test("reduced motion: camera presets jump instantly", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openStage(page);
    await page.getByRole("button", { name: "Side", exact: true }).click();
    await page.waitForTimeout(250);
    expect((await readState(page)).camera!.position).toEqual([14, 2.2, 0]);
  });
});

test.describe("3D Stage Configurator — touch", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "touch-only");
  });

  test("one-finger drag moves a member on a touch device", async ({ page }) => {
    await openStage(page);
    // Other tests save drafts; start from the default arrangement (unsaved, local only).
    await page.getByRole("button", { name: "Default layout" }).click();
    await topView(page);
    const at = await topViewMapper(page);
    const from = at(0, 1.75);
    const to = at(1.5, 1.75);
    const cdp = await page.context().newCDPSession(page);
    const point = (p: { x: number; y: number }) => [{ x: p.x, y: p.y, id: 1 }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(from) });
    for (let i = 1; i <= 10; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point({ x: from.x + ((to.x - from.x) * i) / 10, y: from.y }) });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => pos(page, "member-vocal")).toEqual([1.5, 0, 1.75]);
  });

  test("toolbar fits the phone screen without horizontal scroll", async ({ page }) => {
    await openStage(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("3D Stage — label collisions", () => {
  const boxes = (page: Page) =>
    page.locator("[data-label-id]").evaluateAll((els) =>
      els
        .filter((e) => (e as HTMLElement).style.visibility === "visible")
        .map((e) => {
          const r = e.getBoundingClientRect();
          return { id: (e as HTMLElement).dataset.labelId!, l: r.left, r: r.right, t: r.top, b: r.bottom };
        })
    );
  const noOverlap = (bs: { l: number; r: number; t: number; b: number }[]) =>
    bs.every((a, i) => bs.every((b, j) => i === j || a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t));

  test("front view: vocal in front of the drummer — every member tag shows, none overlap; selection wins", async ({ page }) => {
    await openStage(page);
    await page.getByRole("button", { name: "Default layout" }).click();
    await page.getByRole("button", { name: "Front", exact: true }).click();
    await expect.poll(async () => (await readState(page)).camera!.position[2], { timeout: 10000 }).toBeGreaterThan(13.9);
    const before = (await readState(page)).items;

    await expect.poll(async () => (await boxes(page)).map((b) => b.id).sort(), { timeout: 5000 }).toEqual(
      ["member-bass", "member-drums", "member-guitar", "member-keys", "member-vocal"]
    );
    expect(noOverlap(await boxes(page))).toBe(true);

    // Selecting an object adds its tag and it is never the one pushed aside or hidden
    await page.getByRole("button", { name: /^Drum kit/ }).click();
    await expect.poll(async () => page.locator('[data-label-id="drums"]').getAttribute("data-label-state"), { timeout: 5000 }).toBe("anchor");
    expect(noOverlap(await boxes(page))).toBe(true);

    // Labels moved, objects did not
    expect((await readState(page)).items).toEqual(before);

    // Label toggle still hides member tags
    await page.getByRole("button", { name: "Labels" }).click();
    await expect.poll(async () => (await boxes(page)).map((b) => b.id)).toEqual(["drums"]);
  });
});
