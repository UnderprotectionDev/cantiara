import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

test("Favorites membership persists, supports keyboard input, and retains its state after a failed removal", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const setupResponse = await request.get(
    `${serverUrl}/__e2e/setup?fixture=favorites`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([setup.cookie]);
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Favorites Persistence");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Favorites Persistence", exact: true })
    .click();
  const overview = page.locator("#overview");
  const add = overview.getByRole("button", {
    name: "Add to Favorites",
    exact: true,
  });
  await expect(add).toBeEnabled();
  await add.focus();
  await page.keyboard.press("Enter");
  const remove = overview.getByRole("button", {
    name: "Remove from Favorites",
    exact: true,
  });
  await expect(remove).toBeEnabled();
  await page.reload();
  await expect(remove).toBeEnabled();
  await page.route("**/rpc/removeFromFavorites", (route) => route.abort());
  await remove.click();
  await expect(overview.getByRole("alert")).toBeVisible();
  await expect(remove).toBeEnabled();
  await page.unroute("**/rpc/removeFromFavorites");
  await remove.click();
  await expect(add).toBeEnabled();
  await page.reload();
  await expect(add).toBeEnabled();
  await expect(overview.getByText("Active", { exact: true })).toBeVisible();
});

test("Decision Favorites preserves its source content and life across membership changes", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=favorites-decisions`,
  );
  expect(response.ok()).toBe(true);
  const setup = await response.json();
  await context.addCookies([setup.cookie]);
  await page.goto(`/projects/${setup.projectId}#decisions`);
  await page
    .getByRole("region", { name: "Decisions", exact: true })
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Favorite release decision");
  await page
    .getByLabel("Decision text", { exact: true })
    .fill("Keep the source unchanged.");
  await page
    .getByLabel("Rationale (optional)", { exact: true })
    .fill("Personal access only.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Decision saved.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Favorite release decision", exact: true })
    .click();
  const detail = page.getByRole("article", { name: "Decision", exact: true });
  const decisionsSurface = page
    .getByRole("region", { name: "Decisions", exact: true })
    .locator("..");
  const add = decisionsSurface.getByRole("button", {
    name: "Add to Favorites",
    exact: true,
  });
  await expect(add).toBeEnabled({ timeout: 5000 });
  await add.click();
  const remove = decisionsSurface.getByRole("button", {
    name: "Remove from Favorites",
    exact: true,
  });
  await expect(remove).toBeEnabled();
  await page.reload();
  await expect(remove).toBeEnabled();
  await remove.click();
  await expect(add).toBeEnabled();
  await page.reload();
  await expect(add).toBeEnabled();
  await expect(detail).toContainText("Valid");
  await expect(detail).toContainText("Keep the source unchanged.");
  await expect(detail).toContainText("Personal access only.");
});
