import { test, expect, type Page } from "@playwright/test";

/**
 * WS-07 multi-member stage editing (local, unsaved changes only — saving the shared
 * Freefallers draft lives in the serial workflow in public-stage.spec.ts).
 */

interface Item { id: string; p: [number, number, number]; r: number; label: string; m?: string; role?: string }

async function items(page: Page): Promise<Item[]> {
  return page.getByTestId("stage-state").evaluate((el) => JSON.parse((el as HTMLElement).dataset.items ?? "[]"));
}
const byId = async (page: Page, id: string) => (await items(page)).find((i) => i.id === id);
const added = async (page: Page) => (await items(page)).filter((i) => i.m && i.role);
/** Buttons in the object list (not the lineup cards above the stage). */
const listItem = (page: Page, name: RegExp | string) => page.getByRole("complementary", { name: "Stage objects" }).getByRole("button", { name });

async function openStage(page: Page) {
  await page.request.post("/api/auth/signin", { data: { email: "studio@freefallers.com", password: "demo" } });
  await page.goto("/studio/stage");
  await expect(page.getByTestId("stage-viewport").locator("canvas")).toBeVisible({ timeout: 20000 });
  await expect.poll(async () => page.getByTestId("stage-state").getAttribute("data-camera"), { timeout: 10000 }).not.toBe("");
  // Other tests save drafts; start from the default arrangement (unsaved, local only).
  await page.getByRole("button", { name: "Default layout" }).click();
}

async function addMember(page: Page, role: string) {
  await page.getByLabel("New member role").selectOption({ label: role });
  await page.getByRole("button", { name: "Add member" }).click();
}

async function topView(page: Page) {
  await page.getByRole("button", { name: "Top", exact: true }).click();
  await expect
    .poll(async () => {
      const c = JSON.parse((await page.getByTestId("stage-state").getAttribute("data-camera")) || "null");
      return !!c && c.position[1] >= 15.99 && Math.abs(c.position[0]) < 0.02;
    }, { timeout: 10000 })
    .toBe(true);
}

async function topViewMapper(page: Page) {
  await page.getByTestId("stage-viewport").scrollIntoViewIfNeeded();
  const box = (await page.getByTestId("stage-viewport").locator("canvas").boundingBox())!;
  const visH = 2 * 16 * Math.tan((22.5 * Math.PI) / 180);
  const aspect = box.width / box.height;
  return (x: number, z: number) => ({ x: box.x + box.width / 2 + (x / (visH * aspect)) * box.width, y: box.y + box.height / 2 + (z / visH) * box.height });
}

test.describe("Stage — multiple members per role", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name.includes("mobile"), "desktop pointer tests; touch is covered below");
  });

  test("two guitarists get independent identities, labels, instruments and inspector state", async ({ page }) => {
    await openStage(page);
    await addMember(page, "Guitar");
    await addMember(page, "Guitar");
    const [g2, g3] = await added(page);
    expect([g2!.label, g3!.label]).toEqual(["Guitar 2", "Guitar 3"]);
    expect(g2!.m).not.toBe(g3!.m);
    expect(g2!.id).not.toBe(g2!.m);
    expect((await items(page)).filter((i) => i.m === g2!.m && !i.role)).toHaveLength(1); // its own guitar

    await listItem(page, /^Guitar 2/).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Guitar 2");
    await expect(page.getByLabel("Role", { exact: true })).toHaveValue("guitar");
    await listItem(page, /^Guitar 3/).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Guitar 3");
    await expect(listItem(page, /^Guitar 3 performer/)).toHaveAttribute("aria-pressed", "true");
    await expect(listItem(page, /^Guitar 2 performer/)).toHaveAttribute("aria-pressed", "false");
    // Built-in members are still there and unchanged
    expect((await byId(page, "member-guitar"))!.p).toEqual([2.5, 0, 0.5]);
  });

  test("dragging one same-role member moves only that member; undo/redo target it; camera changes keep positions", async ({ page }) => {
    await openStage(page);
    await addMember(page, "Vocal");
    await addMember(page, "Vocal");
    const [a, b] = await added(page);
    await topView(page);
    const at = await topViewMapper(page);
    const target: [number, number] = [a!.p[0] - 1.5, a!.p[2] + 1.25];
    await page.mouse.move(at(a!.p[0], a!.p[2]).x, at(a!.p[0], a!.p[2]).y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      const p = at(a!.p[0] + ((target[0] - a!.p[0]) * i) / 10, a!.p[2] + ((target[1] - a!.p[2]) * i) / 10);
      await page.mouse.move(p.x, p.y);
    }
    await page.mouse.up();
    await expect.poll(async () => (await byId(page, a!.id))!.p).not.toEqual(a!.p);
    const moved = (await byId(page, a!.id))!.p;
    expect((await byId(page, b!.id))!.p).toEqual(b!.p);

    await page.getByRole("button", { name: "Undo" }).click();
    expect((await byId(page, a!.id))!.p).toEqual(a!.p);
    expect((await byId(page, b!.id))!.p).toEqual(b!.p);
    await page.getByRole("button", { name: "Redo" }).click();
    expect((await byId(page, a!.id))!.p).toEqual(moved);

    await page.getByRole("button", { name: "Front", exact: true }).click();
    await page.getByRole("button", { name: "Perspective", exact: true }).click();
    expect((await byId(page, a!.id))!.p).toEqual(moved);
    expect((await byId(page, b!.id))!.p).toEqual(b!.p);
  });

  test("rename, role change, instrument link and removal; typing a name never moves the member", async ({ page }) => {
    await openStage(page);
    await addMember(page, "Bass");
    const [m] = await added(page);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Bass 2"); // the new member is selected

    const name = page.getByLabel("Name", { exact: true });
    await name.fill("Jae");
    await name.press("ArrowLeft");
    await name.press("Enter");
    await expect(listItem(page, /^Jae/)).toBeVisible();
    expect((await byId(page, m!.id))!.p).toEqual(m!.p);
    expect((await items(page)).find((i) => i.m === m!.m && !i.role)!.label).toBe("Bass · Jae");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(listItem(page, /^Bass 2/)).toBeVisible();
    await page.getByRole("button", { name: "Redo" }).click();

    await listItem(page, /^Jae/).click();
    await page.getByLabel("Role", { exact: true }).selectOption("keys");
    const inst = (await items(page)).find((i) => i.m === m!.m && !i.role)!;
    expect(inst.id).not.toBe(m!.id);
    await listItem(page, /^Keyboard · Jae/).click();
    await expect(page.getByText("Played by")).toBeVisible();
    await page.getByRole("button", { name: "Jae", exact: true }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Jae");

    await page.getByRole("button", { name: "Remove from stage" }).click();
    expect((await items(page)).some((i) => i.m === m!.m)).toBe(false);
    await expect(page.getByText("Select a member or instrument on the stage or in the list.")).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    expect((await items(page)).filter((i) => i.m === m!.m)).toHaveLength(2);
  });

  test("built-in members can be renamed but not re-roled or removed from the inspector", async ({ page }) => {
    await openStage(page);
    await listItem(page, /^Vocal performer/).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Vocal");
    await expect(page.getByLabel("Role", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Remove from stage" })).toHaveCount(0);
    await expect(page.getByText("Built-in member")).toBeVisible();
  });
});

test.describe("Stage — multiple members on touch", () => {
  test("one-finger drag moves an added member and leaves its same-role partner", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "touch project only");
    await openStage(page);
    await addMember(page, "Vocal");
    await addMember(page, "Vocal");
    const [a, b] = await added(page);
    await topView(page);
    const at = await topViewMapper(page);
    const from = at(a!.p[0], a!.p[2]);
    const to = at(a!.p[0] - 1, a!.p[2] + 1);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y, id: 1 }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + ((to.x - from.x) * i) / 10, y: from.y + ((to.y - from.y) * i) / 10, id: 1 }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(async () => (await byId(page, a!.id))!.p).not.toEqual(a!.p);
    expect((await byId(page, b!.id))!.p).toEqual(b!.p);
  });
});
