import { expect, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const DAILY_FOCUS_DATE_LABEL = /Daily Focus · \d{4}-\d{2}-\d{2}/;
const WORK_STATUS_COMBOBOX_NAME = /Status for/;

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

test("previews, applies, and undoes a Record Action from its Work", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=record-actions`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([setup.cookie]);

  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Record Action Run Acceptance");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Record Action Run Acceptance", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Title").fill("Prepare the release");
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
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
  const form = host.getByRole("form", { name: "Record Action" });
  await form.getByLabel("Name").fill("Start Work");
  await form.getByLabel("Work status").selectOption("In Progress");
  await form.getByLabel("Daily Focus").selectOption("add");
  await form.getByRole("button", { name: "Save", exact: true }).click();

  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  const record = page
    .getByRole("list", { name: "Work list" })
    .getByRole("listitem")
    .filter({ hasText: "Prepare the release" });
  await record.getByRole("button", { name: "Start Work", exact: true }).click();

  const preview = page.getByRole("dialog", { name: "Preview Start Work" });
  await expect(preview).toContainText("Not Started → In Progress");
  await expect(preview).toContainText("Not in Daily Focus → In Daily Focus");
  await expect(preview).toContainText(DAILY_FOCUS_DATE_LABEL);
  await preview.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(preview.getByRole("status")).toHaveText("Finalizing");
  await expect(preview.getByRole("status")).toHaveText("Start Work applied.");

  await preview.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(preview.getByRole("status")).toHaveText(
    "Start Work was undone.",
  );
  await preview.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    record.getByRole("combobox", { name: WORK_STATUS_COMBOBOX_NAME }),
  ).toHaveValue("Not Started");

  await page.reload();
  const persistedRecord = page
    .getByRole("list", { name: "Work list" })
    .getByRole("listitem")
    .filter({ hasText: "Prepare the release" });
  await expect(
    persistedRecord.getByRole("combobox", {
      name: WORK_STATUS_COMBOBOX_NAME,
    }),
  ).toHaveValue("Not Started");

  await persistedRecord
    .getByRole("button", { name: "Start Work", exact: true })
    .click();
  const stalePreview = page.getByRole("dialog", {
    name: "Preview Start Work",
  });
  await expect(stalePreview).toContainText("Not Started → In Progress");

  const competingPage = await context.newPage();
  await competingPage.goto(page.url());
  await competingPage
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  const competingRecord = competingPage
    .getByRole("list", { name: "Work list" })
    .getByRole("listitem")
    .filter({ hasText: "Prepare the release" });
  await competingRecord
    .getByRole("combobox", { name: WORK_STATUS_COMBOBOX_NAME })
    .selectOption("Blocked");
  await expect(
    competingRecord.getByRole("combobox", {
      name: WORK_STATUS_COMBOBOX_NAME,
    }),
  ).toHaveValue("Blocked");
  await competingPage.close();

  await stalePreview
    .getByRole("button", { name: "Apply", exact: true })
    .click();
  await expect(stalePreview.getByRole("status")).toHaveText(
    "Start Work was not applied. Work changed, and no changes were saved. Start again to review the current values.",
  );
  const currentValue = stalePreview.getByRole("region", {
    name: "Current value",
  });
  await expect(currentValue).toContainText("Work status");
  await expect(currentValue).toContainText("Blocked");
  await stalePreview
    .locator('[data-slot="dialog-footer"]')
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.reload();
  await expect(
    page
      .getByRole("list", { name: "Work list" })
      .getByRole("listitem")
      .filter({ hasText: "Prepare the release" })
      .getByRole("combobox", { name: WORK_STATUS_COMBOBOX_NAME }),
  ).toHaveValue("Blocked");
});
