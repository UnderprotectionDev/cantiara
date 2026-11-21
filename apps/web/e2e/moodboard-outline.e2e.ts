import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const swatchName = /^Color Swatch #/;
const dragTargetAnnouncement = /was moved over droppable target/;

test("Moodboard Outline keyboard reorder keeps the saved order on cancel or rejection", async ({
  context,
  page,
  request,
}) => {
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=project-shell`,
  );
  expect(response.ok()).toBe(true);
  const setup = (await response.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([{ ...setup.cookie, expires: -1 }]);

  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Outline Acceptance");
  await page
    .getByLabel("Starter Configuration", { exact: true })
    .selectOption({ label: "Solo SaaS" });
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Outline Acceptance", exact: true })
    .click();
  await page.goto(`${page.url()}#moodboard-`);

  const surface = page.getByRole("region", { name: "Moodboard", exact: true });
  await surface.getByLabel("Title", { exact: true }).fill("Outline order");
  await surface.getByRole("button", { name: "Create Moodboard" }).click();
  const outline = page.getByRole("region", { name: "Outline", exact: true });
  const addSwatch = outline.getByRole("form", { name: "Add Color Swatch" });
  const rows = outline.getByRole("button", { name: swatchName });

  await addSwatch
    .getByRole("textbox", { name: "Color (HEX, RGB, or HSL)" })
    .fill("#112233");
  await addSwatch.getByRole("button", { name: "Add Color Swatch" }).click();
  await expect(rows).toHaveText(["Color Swatch #112233"]);
  await addSwatch
    .getByRole("textbox", { name: "Color (HEX, RGB, or HSL)" })
    .fill("#445566");
  await addSwatch.getByRole("button", { name: "Add Color Swatch" }).click();
  const originalOrder = ["Color Swatch #112233", "Color Swatch #445566"];
  await expect(rows).toHaveText(originalOrder);

  const handle = outline.getByRole("button", {
    name: "Drag Color Swatch #445566",
    exact: true,
  });
  const announcement = page.locator('div[role="status"][aria-live="polite"]');
  async function moveSecondSwatch() {
    await expect(handle).toBeEnabled();
    await expect(handle).toHaveAttribute("aria-busy", "false");
    await handle.focus();
    await page.keyboard.press("Space");
    await expect(handle).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("ArrowUp");
    await expect(
      announcement.filter({ hasText: dragTargetAnnouncement }),
    ).toBeAttached();
  }

  await moveSecondSwatch();
  await page.keyboard.press("Escape");
  await expect(handle).toHaveAttribute("aria-busy", "false");
  await expect(handle).toBeFocused();
  await expect(rows).toHaveText(originalOrder);

  const rejectWrite = Promise.withResolvers<void>();
  await page.route(
    "**/rpc/reorderMoodboardItems",
    async (route) => {
      await rejectWrite.promise;
      await route.fulfill({
        status: 400,
        json: {
          json: {
            code: "BAD_REQUEST",
            defined: false,
            message: "Moodboard order was rejected.",
            status: 400,
          },
        },
      });
    },
    { times: 1 },
  );
  await moveSecondSwatch();
  await page.keyboard.press("Space");
  await expect(handle).toBeDisabled();
  await expect(handle).toHaveAttribute("aria-busy", "false");
  await expect(handle).toBeFocused();
  rejectWrite.resolve();
  await expect(surface.getByRole("alert")).toHaveText(
    "Moodboard order was rejected.",
  );
  await expect(handle).toBeFocused();
  await expect(rows).toHaveText(originalOrder);

  await moveSecondSwatch();
  await page.keyboard.press("Space");
  await expect(rows).toHaveText([...originalOrder].reverse());
  await page.reload();
  await expect(rows).toHaveText([...originalOrder].reverse());
});
