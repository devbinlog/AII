import { test, expect, type Page } from "@playwright/test";

/**
 * WS-06 Scene Editor direct manipulation — E2E (MOCK_ONLY).
 * Every test builds its own scene through the Studio API, so runs never share drafts.
 */

const W = 1920;
const H = 1080;

async function signIn(page: Page) {
  const res = await page.request.post("/api/auth/signin", { data: { email: "studio@freefallers.com", password: "demo" } });
  expect(res.ok()).toBe(true);
}

function rect(id: string, name: string, x: number, y: number, width: number, height: number, z: number) {
  const now = "2026-11-25T00:00:00.000Z";
  return {
    id,
    name,
    transform: { x, y, z, width, height, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    style: { fill: "#e8192c", stroke: null, strokeWidth: 0, fontSize: null, fontFamily: null, fontWeight: null, textAlign: null, borderRadius: 0, blendMode: "normal" },
    data: { type: "shape", variant: "rectangle" },
    visible: true,
    locked: false,
    parentId: null,
    createdAt: now,
    updatedAt: now,
  };
}

const BOX_A = rect("box_a", "Box A", 600, 400, 400, 240, 0);
const BOX_B = rect("box_b", "Box B", 1400, 700, 300, 200, 1);

async function createScene(page: Page, name: string, objects: unknown[] = [BOX_A, BOX_B]): Promise<{ id: string; schema: Record<string, unknown> }> {
  const created = await page.request.post("/api/studio/scenes", { data: { name } });
  expect(created.status()).toBe(201);
  const { scene } = (await created.json()) as { scene: { id: string; schema: Record<string, unknown> } };
  const schema = { ...scene.schema, objects };
  const put = await page.request.put(`/api/studio/scenes/${scene.id}`, { data: { schema } });
  expect(put.ok()).toBe(true);
  return { id: scene.id, schema };
}

async function readScene(page: Page, id: string) {
  const res = await page.request.get(`/api/studio/scenes/${id}`);
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { scene: { schema: { objects: { id: string; locked: boolean; transform: Record<string, number> }[] } } }).scene;
}

async function openEditor(page: Page, id: string) {
  await page.goto(`/studio/scenes/${id}`);
  await expect(page.locator("[data-hydrated]")).toBeAttached();
  await expect(page.locator("[data-scene-canvas]")).toBeVisible();
}

/** Scene coordinates → page coordinates, using the same letterbox fit as the renderer. */
async function stage(page: Page) {
  const canvas = page.locator("[data-scene-canvas]");
  // Centre it: the sticky site header would otherwise cover the canvas's top edge.
  await canvas.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
  const b = (await canvas.boundingBox())!;
  const scale = Math.min(b.width / W, b.height / H);
  const ox = b.x + (b.width - W * scale) / 2;
  const oy = b.y + (b.height - H * scale) / 2;
  return { scale, at: (x: number, y: number) => ({ x: ox + x * scale, y: oy + y * scale }) };
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, opts: { steps?: number; beforeUp?: () => Promise<void> } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const steps = opts.steps ?? 12;
  for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
  if (opts.beforeUp) await opts.beforeUp();
  await page.mouse.up();
}

const selection = (page: Page) => page.getByTestId("scene-selection");
const field = (page: Page, objId: string, key: string) => page.locator(`#insp-${objId}-${key}`);

test.describe("Scene editor canvas", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("click selects on the canvas, syncs Properties, and clears on empty canvas / Escape", async ({ page }) => {
    const { id } = await createScene(page, `WS06 select ${Date.now()}`);
    await openEditor(page, id);
    const s = await stage(page);

    await page.mouse.click(s.at(1400, 700).x, s.at(1400, 700).y);
    await expect(selection(page)).toHaveAttribute("data-object-id", "box_b");
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Box B");
    await expect(page.getByRole("button", { name: "Box B", exact: false }).first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("selection-readout")).toContainText("Box B · X 1400 · Y 700 · 300×200 · 0°");
    await expect(page.getByTestId("canvas-announcer")).toHaveText("Selected Box B");

    // Layer list → canvas selection
    await page.getByRole("button", { name: /^Box A/ }).click();
    await expect(selection(page)).toHaveAttribute("data-object-id", "box_a");

    // Empty area (the layer click may have scrolled the page: measure again)
    const s2 = await stage(page);
    await page.mouse.click(s2.at(1800, 100).x, s2.at(1800, 100).y);
    await expect(selection(page)).toHaveCount(0);
    await expect(page.getByText("Select a layer to edit its properties.")).toBeVisible();

    await page.mouse.click(s2.at(600, 400).x, s2.at(600, 400).y);
    await expect(selection(page)).toHaveAttribute("data-object-id", "box_a");
    await page.keyboard.press("Escape");
    await expect(selection(page)).toHaveCount(0);

    // Selecting never edits the draft
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  });

  test("drag moves with a live preview, commits once on release, saves, reloads, undo/redo", async ({ page }) => {
    const { id } = await createScene(page, `WS06 drag ${Date.now()}`);
    await openEditor(page, id);
    await page.getByLabel("Alignment guides").uncheck();
    const s = await stage(page);
    const dx = 200 * s.scale;
    const dy = 100 * s.scale;
    const from = s.at(600, 400);

    await drag(page, from, { x: from.x + dx, y: from.y + dy }, {
      beforeUp: async () => {
        // Mid-drag: the overlay shows live values, the editor state is untouched.
        await expect(page.getByTestId("scene-transform-readout")).toBeVisible();
        await expect(field(page, "box_a", "x")).toHaveValue("600");
        await expect(page.getByText("Saved", { exact: true })).toBeVisible();
      },
    });
    await expect(page.getByTestId("scene-transform-readout")).toHaveCount(0);
    const x = Number(await field(page, "box_a", "x").inputValue());
    const y = Number(await field(page, "box_a", "y").inputValue());
    // One screen pixel is 1/scale scene units (≈5 on a phone), so allow that much pointer rounding.
    const tol = Math.max(2, 1 / s.scale);
    expect(Math.abs(x - 800)).toBeLessThanOrEqual(tol);
    expect(Math.abs(y - 500)).toBeLessThanOrEqual(tol);
    await expect(page.getByText("Unsaved", { exact: true })).toBeVisible();

    // One drag = one undo step
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(field(page, "box_a", "x")).toHaveValue("600");
    await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
    await page.getByRole("button", { name: "Redo" }).click();
    await expect(field(page, "box_a", "x")).toHaveValue(String(x));

    await page.getByRole("button", { name: "Save scene" }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    const saved = await readScene(page, id);
    expect(saved.schema.objects.find((o) => o.id === "box_a")!.transform).toMatchObject({ x, y, width: 400, height: 240, rotation: 0 });
    // The other object is untouched
    expect(saved.schema.objects.find((o) => o.id === "box_b")!.transform).toEqual(BOX_B.transform);

    await page.reload();
    await expect(page.locator("[data-hydrated]")).toBeAttached();
    await page.getByRole("button", { name: /^Box A/ }).click();
    await expect(field(page, "box_a", "x")).toHaveValue(String(x));
    await expect(field(page, "box_a", "y")).toHaveValue(String(y));
  });

  test("a click without movement does not edit; dragging stays inside the scene", async ({ page }) => {
    const { id } = await createScene(page, `WS06 bounds ${Date.now()}`);
    await openEditor(page, id);
    const s = await stage(page);
    const p = s.at(1400, 700);
    await page.mouse.click(p.x, p.y);
    await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();

    // Throw Box B far past the bottom-right corner.
    const b = (await page.locator("[data-scene-canvas]").boundingBox())!;
    await drag(page, p, { x: b.x + b.width + 300, y: b.y + b.height + 300 });
    await expect(field(page, "box_b", "x")).toHaveValue(String(W - 150));
    await expect(field(page, "box_b", "y")).toHaveValue(String(H - 100));
  });

  test("Escape during a drag cancels it", async ({ page }) => {
    const { id } = await createScene(page, `WS06 cancel ${Date.now()}`);
    await openEditor(page, id);
    const s = await stage(page);
    const from = s.at(600, 400);
    await drag(page, from, { x: from.x + 80, y: from.y + 40 }, { beforeUp: () => page.keyboard.press("Escape") });
    await expect(field(page, "box_a", "x")).toHaveValue("600");
    await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
    // The selection itself survives the cancel
    await expect(selection(page)).toHaveAttribute("data-object-id", "box_a");
  });

  test("keyboard: arrows nudge (Shift ×10), Delete removes, text fields keep their keys", async ({ page }) => {
    const { id } = await createScene(page, `WS06 keys ${Date.now()}`);
    await openEditor(page, id);
    const s = await stage(page);
    await page.mouse.click(s.at(600, 400).x, s.at(600, 400).y);

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowDown");
    await expect(field(page, "box_a", "x")).toHaveValue("602");
    await expect(field(page, "box_a", "y")).toHaveValue("410");
    // Repeated nudges coalesce into one undo step
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(field(page, "box_a", "x")).toHaveValue("600");
    await expect(field(page, "box_a", "y")).toHaveValue("400");

    // Typing in the layer name: arrows/Backspace edit the text, not the object.
    const name = page.getByLabel("Name", { exact: true });
    await name.click();
    await name.press("End");
    await name.press("ArrowLeft");
    await name.press("Backspace");
    await name.press("Delete");
    await expect(name).toHaveValue("Box");
    await expect(field(page, "box_a", "x")).toHaveValue("600");
    await expect(page.getByRole("button", { name: /^Box\b/ }).first()).toBeVisible();

    // Number fields keep their arrow keys too
    await field(page, "box_a", "y").focus();
    await page.keyboard.press("ArrowUp");
    await expect(field(page, "box_a", "y")).toHaveValue("401");
    await expect(field(page, "box_a", "x")).toHaveValue("600");

    // Back on the canvas, Delete removes the selection; undo brings it back.
    const s2 = await stage(page);
    await page.mouse.click(s2.at(600, 401).x, s2.at(600, 401).y);
    await page.keyboard.press("Delete");
    await expect(selection(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Layers (1/200)" })).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("heading", { name: "Layers (2/200)" })).toBeVisible();
  });

  test("locked objects: not pickable on canvas, transform read-only, no keyboard edits or delete", async ({ page }) => {
    const { id } = await createScene(page, `WS06 lock ${Date.now()}`);
    await openEditor(page, id);
    await page.getByRole("button", { name: "Lock Box B" }).click();
    await expect(page.getByRole("button", { name: "Unlock Box B" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Delete Box B" })).toBeDisabled();

    const s = await stage(page);
    // Clicking the locked box selects nothing; dragging it does nothing.
    await page.mouse.click(s.at(1400, 700).x, s.at(1400, 700).y);
    await expect(selection(page)).toHaveCount(0);
    await drag(page, s.at(1400, 700), s.at(1000, 500));

    // Selected from the layer list it shows a locked outline without handles.
    await page.getByRole("button", { name: /^Box B/ }).click();
    await expect(selection(page)).toHaveAttribute("data-locked", "");
    await expect(selection(page).locator("[data-handle]")).toHaveCount(0);
    await expect(page.getByText("Locked. Unlock the layer to move, resize or rotate it.")).toBeVisible();
    await expect(field(page, "box_b", "x")).toBeDisabled();
    await page.locator("[data-scene-canvas]").focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Delete");
    await expect(field(page, "box_b", "x")).toHaveValue("1400");
    await expect(page.getByTestId("canvas-announcer")).toHaveText("Box B is locked");

    await page.getByRole("button", { name: "Save scene" }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    const saved = await readScene(page, id);
    const b = saved.schema.objects.find((o) => o.id === "box_b")!;
    expect(b.locked).toBe(true);
    expect(b.transform).toEqual(BOX_B.transform);
  });

  test("resize and rotation handles update width/height/rotation; Shift snaps rotation", async ({ page }) => {
    const { id } = await createScene(page, `WS06 handles ${Date.now()}`);
    await openEditor(page, id);
    const s = await stage(page);
    await page.mouse.click(s.at(600, 400).x, s.at(600, 400).y);

    const east = (await selection(page).locator('[data-handle="e"]').boundingBox())!;
    const ex = east.x + east.width / 2;
    const ey = east.y + east.height / 2;
    await drag(page, { x: ex, y: ey }, { x: ex + 100 * s.scale, y: ey });
    const w = Number(await field(page, "box_a", "w").inputValue());
    expect(Math.abs(w - 500)).toBeLessThanOrEqual(Math.max(2, 1 / s.scale));
    await expect(field(page, "box_a", "h")).toHaveValue("240");
    // The west edge stayed where it was: x moved by half the growth.
    const x = Number(await field(page, "box_a", "x").inputValue());
    expect(Math.abs(x - (600 + (w - 400) / 2))).toBeLessThanOrEqual(0.51);

    const rot = (await selection(page).locator('[data-handle="rotate"]').boundingBox())!;
    const rx = rot.x + rot.width / 2;
    const ry = rot.y + rot.height / 2;
    const c = s.at(x, 400);
    // Sweep from straight up to roughly 40° clockwise, holding Shift → snaps to 45°.
    const r = ry - c.y;
    const target = { x: c.x - r * Math.sin((40 * Math.PI) / 180), y: c.y + r * Math.cos((40 * Math.PI) / 180) };
    await page.keyboard.down("Shift");
    await drag(page, { x: rx, y: ry }, target);
    await page.keyboard.up("Shift");
    await expect(field(page, "box_a", "rot")).toHaveValue("45");
    await expect(page.getByTestId("selection-readout")).toContainText("45°");
  });

  test("grid snap and alignment guides", async ({ page }) => {
    const { id } = await createScene(page, `WS06 snap ${Date.now()}`);
    await openEditor(page, id);
    const s = await stage(page);

    // Guides: drag Box A's centre close to the scene's vertical centre line.
    const from = s.at(600, 400);
    const near = s.at(962, 400);
    await drag(page, from, near, {
      beforeUp: async () => {
        await expect(page.getByTestId("scene-guide-x")).toBeVisible();
      },
    });
    await expect(field(page, "box_a", "x")).toHaveValue("960");
    await expect(page.getByTestId("scene-guide-x")).toHaveCount(0);

    // Grid: with guides off and a 40-unit grid, the drop lands on a multiple of 40.
    await page.getByLabel("Alignment guides").uncheck();
    await page.getByLabel("Grid size").selectOption("40");
    await page.getByLabel("Snap to grid").check();
    await expect(page.getByTestId("scene-grid")).toBeVisible();
    const sg = await stage(page);
    const p = sg.at(1400, 700);
    await drag(page, p, { x: p.x - 123 * sg.scale, y: p.y - 77 * sg.scale });
    const gx = Number(await field(page, "box_b", "x").inputValue());
    const gy = Number(await field(page, "box_b", "y").inputValue());
    expect(gx % 40).toBe(0);
    expect(gy % 40).toBe(0);
  });

  test("while the preview plays, the canvas belongs to the scene's own interactions", async ({ page }) => {
    const { id } = await createScene(page, `WS06 play ${Date.now()}`);
    await openEditor(page, id);
    const s = await stage(page);
    await page.mouse.click(s.at(1800, 100).x, s.at(1800, 100).y);
    await expect(selection(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByText("Pause or reset to edit on the canvas.")).toBeVisible();
    await expect(page.locator("[data-scene-canvas]")).toHaveAttribute("aria-disabled", "true");
    await page.mouse.click(s.at(600, 400).x, s.at(600, 400).y);
    await expect(selection(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Pause" }).click();
    await page.mouse.click(s.at(600, 400).x, s.at(600, 400).y);
    await expect(selection(page)).toHaveAttribute("data-object-id", "box_a");
  });

  test("switching scenes starts with fresh selection and history", async ({ page }) => {
    const a = await createScene(page, `WS06 iso A ${Date.now()}`);
    const b = await createScene(page, `WS06 iso B ${Date.now()}`, [rect("only_b", "Only B", 960, 540, 200, 200, 0)]);
    await openEditor(page, a.id);
    const s = await stage(page);
    await page.mouse.click(s.at(1400, 700).x, s.at(1400, 700).y);
    await page.keyboard.press("ArrowLeft");
    await page.getByRole("button", { name: "Save scene" }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();

    // Client-side navigation through the scene library
    await page.getByRole("link", { name: "← Scenes" }).click();
    await page.locator(`a[href="/studio/scenes/${b.id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/studio/scenes/${b.id}$`));
    await expect(page.locator("[data-hydrated]")).toBeAttached();
    await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
    await expect(page.getByRole("button", { name: /^Only B/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /^Box A/ })).toHaveCount(0);
    expect((await readScene(page, b.id)).schema.objects[0]!.transform.x).toBe(960);
  });
});

test.describe("Scene editor canvas — touch", () => {
  test("tap selects and a touch drag moves the object", async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== "chromium" || !testInfo.project.use.hasTouch, "CDP touch input: Chromium touch projects only");
    await signIn(page);
    const { id } = await createScene(page, `WS06 touch ${Date.now()}`);
    await openEditor(page, id);
    const s = await stage(page);
    const p = s.at(600, 400);
    await page.touchscreen.tap(p.x, p.y);
    await expect(selection(page)).toHaveAttribute("data-object-id", "box_a");

    const cdp = await page.context().newCDPSession(page);
    const to = { x: p.x + 150 * s.scale, y: p.y + 50 * s.scale };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: p.x + ((to.x - p.x) * i) / 10, y: p.y + ((to.y - p.y) * i) / 10 }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    const x = Number(await field(page, "box_a", "x").inputValue());
    expect(x).toBeGreaterThan(700);
    // The page did not scroll instead of dragging
    expect(await page.evaluate(() => window.scrollX)).toBe(0);
  });
});
