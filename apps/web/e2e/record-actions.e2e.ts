import { expect, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

test("defines, reloads, and trashes a single-record Start Work action", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=record-actions`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([setup.cookie]);

  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Record Actions Acceptance");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Record Actions Acceptance", exact: true })
    .click();
  await page.getByRole("button", { name: "Configuration Mode" }).click();

  const configuration = page.locator(
    'section[aria-label="Configuration Mode"]',
  );
  await configuration
    .getByRole("button", { name: "Record Action", exact: true })
    .click();
  const host = configuration.getByRole("region", {
    exact: true,
    name: "Record Action",
  });
  await expect(host).toBeVisible();

  const form = host.getByRole("form", { name: "Record Action" });
  await form.getByLabel("Name").fill("Start Work");
  await form.getByLabel("Work status").selectOption("In Progress");
  await form.getByLabel("Daily Focus").selectOption("add");
  await form.getByRole("button", { name: "Save", exact: true }).click();

  const item = host
    .getByRole("list", { name: "Record Actions" })
    .getByRole("listitem")
    .filter({ hasText: "Start Work" });
  await expect(item).toBeVisible();
  await expect(item).toContainText("Work status → In Progress");
  await expect(item).toContainText("Daily Focus → Add");
  await expect(host).toContainText(
    "Each Record Action targets one Work record.",
  );
  await expect(host.getByText("Bulk Edit", { exact: true })).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: "Configuration Mode" }).click();
  await configuration
    .getByRole("button", { name: "Record Action", exact: true })
    .click();
  await expect(
    host
      .getByRole("list", { name: "Record Actions" })
      .getByRole("listitem")
      .filter({ hasText: "Start Work" }),
  ).toBeVisible();

  const persistedItem = host
    .getByRole("list", { name: "Record Actions" })
    .getByRole("listitem")
    .filter({ hasText: "Start Work" });
  await persistedItem.getByRole("button", { name: "Move to Trash" }).click();
  await expect(persistedItem).toHaveCount(0);
});
