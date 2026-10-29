import { expect, type Page, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

function workRow(page: Page, title: string) {
  return page
    .locator('ul[aria-label="Work list"] > li')
    .filter({ hasText: title });
}

test("a reload ends the Active Working Set and the panel starts closed again", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=favorites-sources`,
  );
  expect(response.ok()).toBe(true);
  const setup = await response.json();
  await context.addCookies([setup.cookie]);
  // The Work list (with its More menu) renders for a Work source hash.
  await page.goto(
    `/projects/${setup.projectId}#work-${setup.favorites.workId}`,
  );
  const sourceUrl = page.url();
  const work = workRow(page, "Favorite Work");
  await expect(work).toBeVisible({ timeout: 30_000 });
  await work.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Add to Active Working Set", exact: true })
    .click();
  const setTray = page.getByRole("region", { name: "Active Working Set" });
  await expect(setTray).toContainText("Active Working Set (1)");
  await setTray
    .getByRole("button", { name: "Open source record: FAV-1 Favorite Work" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "FAV-1 Favorite Work", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "FAV-1 Favorite Work", exact: true }),
  ).toHaveCount(0);
  expect(page.url()).toBe(sourceUrl);

  // A reload is a new session: the memory-only set is empty again.
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Active Working Set" }),
  ).toHaveCount(0);
  expect(await page.getByRole("dialog").count()).toBe(0);

  // A new session starts closed on Daily Focus; nothing is restored.
  await page.getByRole("button", { name: "Personal", exact: true }).click();
  const panel = page.getByRole("dialog");
  await expect(panel).toContainText("Daily Focus");
  await expect(
    panel.getByRole("tab", { name: "Favorites", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});
