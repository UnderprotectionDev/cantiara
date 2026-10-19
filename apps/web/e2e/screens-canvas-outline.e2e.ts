import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const PROJECT_URL = /\/projects\/[^/]+/;
const CARD_ROW = /^Card: Card/;
const BUTTON_ROW = /^Button: Button/;
const COLLAPSE_CARD = /^Collapse Card group/;
const EXPAND_CARD = /^Expand Card group/;

// Closed a11y journey "canvas yapılandırılmış outline" (spec 48, ticket 05):
// the structured outline is a functional equivalent of the canvas, so every
// task below uses the keyboard only. It reuses the generic account fixture
// and creates its own Project and Screen through the UI.
test("canvas yapılandırılmış outline: create, select, reorder, inspect, group and restore a personal view by keyboard", async ({
  context,
  page,
  request,
}) => {
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=project-goals`,
  );
  expect(response.ok()).toBe(true);
  const setup = await response.json();
  await context.addCookies([setup.cookie]);
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Outline Acceptance");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Outline Acceptance", exact: true })
    .click();
  await expect(page).toHaveURL(PROJECT_URL);
  await page.goto(`${page.url().split("#")[0]}#design`);
  await page.getByLabel("Title", { exact: true }).fill("Checkout");
  await page.getByRole("button", { name: "Create Screen" }).click();
  await page.getByRole("button", { name: "Open Wireframe" }).click();

  const pane = page.getByTestId("wireframe-pane");
  // Create: toolbar buttons are plain focusable buttons.
  await pane.getByRole("button", { name: "Button", exact: true }).focus();
  await page.keyboard.press("Enter");
  await pane.getByRole("button", { name: "Card", exact: true }).focus();
  await page.keyboard.press("Enter");
  const outline = pane.getByRole("group", { name: "Wireframe outline" });
  await expect(outline.getByRole("button", { name: CARD_ROW })).toBeVisible();

  // Select + inspect + reorder, with Enter/Space only.
  await outline.getByRole("button", { name: BUTTON_ROW }).focus();
  await page.keyboard.press("Enter");
  await expect(
    pane.getByRole("term").filter({ hasText: "Linked block" }),
  ).toBeVisible();
  await expect(
    pane.getByRole("button", { name: "Convert and Bind" }),
  ).toHaveCount(1);
  await pane.getByRole("button", { name: "Move down" }).focus();
  await page.keyboard.press("Enter");

  // Group: collapse is view-local.
  await pane.getByRole("button", { name: COLLAPSE_CARD }).focus();
  await page.keyboard.press("Enter");
  await expect(outline.getByRole("button", { name: CARD_ROW })).toHaveCount(0);

  // Canvas pan/zoom by keyboard, then Fit View.
  const canvas = pane.getByRole("application");
  await canvas.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("+");
  await page.waitForTimeout(800);

  // The personal view survives a reload; selection and inspector do not.
  await page.reload();
  await page.getByRole("button", { name: "Open Wireframe" }).click();
  await expect(pane.getByRole("button", { name: EXPAND_CARD })).toBeVisible();
  await expect(
    pane.getByRole("term").filter({ hasText: "Position" }),
  ).toHaveCount(0);
  await expect(
    pane.getByRole("button", { name: "Convert and Bind" }),
  ).toHaveCount(0);

  await pane.getByRole("button", { name: "Fit View" }).focus();
  await page.keyboard.press("Enter");
});
