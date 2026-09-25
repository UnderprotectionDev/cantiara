import { expect, type Locator, type Page, test } from "@playwright/test";
import { openWorkRecordFromKanbanList } from "./kanban-test-helpers";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const DAILY_FOCUS_DATE_LABEL = /Daily Focus · \d{4}-\d{2}-\d{2}/;
const WORK_STATUS_COMBOBOX_NAME = /Status for/;

type WorkCustomFieldInput =
  | { name: string; type: "Date" | "Number" }
  | { name: string; options: string; type: "Single select" };

async function askWhenRunningForField(form: Locator, fieldName: string) {
  const field = form.getByRole("checkbox", { name: fieldName });
  await field.check();
  await field
    .locator("xpath=../..")
    .getByRole("checkbox", { name: "Ask when running" })
    .check();
}

async function createWorkCustomField(
  page: Page,
  host: Locator,
  field: WorkCustomFieldInput,
) {
  await host.getByLabel("Field name").fill(field.name);
  await host.getByLabel("Type").selectOption(field.type);
  if ("options" in field) {
    await host.getByLabel("Options").fill(field.options);
  }
  await host.getByRole("checkbox", { name: "Work" }).check();
  const response = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "POST" &&
      candidate.url().endsWith("/rpc/createCustomField") &&
      candidate.ok(),
  );
  await host.getByRole("button", { name: "Add custom field" }).click();
  await response;
}

async function fillStartWorkRuntimeInputs(form: Locator) {
  await form.getByLabel("Target date").fill("2026-10-01");
  await form.getByLabel("Estimate").fill("5");
  await form.getByLabel("Readiness").selectOption("Ready");
  const relatedWorkSelect = form.getByLabel("Related Work");
  const relatedWorkOption = relatedWorkSelect
    .locator("option")
    .filter({ hasText: "Prepare the release notes" });
  await relatedWorkSelect.selectOption(
    (await relatedWorkOption.getAttribute("value")) ?? "",
  );
}

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
  await page
    .getByRole("button", { name: "Configuration Mode", exact: true })
    .click();

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
  await expect(
    page.getByRole("button", {
      name: "Exit Configuration Mode",
      exact: true,
    }),
  ).toBeVisible();
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
  test.setTimeout(120_000);
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
  await expect(
    page.getByText("Work REC-1 created.", { exact: true }),
  ).toBeVisible({
    timeout: 60_000,
  });
  const workList = page.getByRole("list", { name: "Work list" });
  await expect(workList).toContainText("Prepare the release", {
    timeout: 30_000,
  });
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Title").fill("Prepare the release notes");
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(
    page.getByText("Work REC-2 created.", { exact: true }),
  ).toBeVisible({
    timeout: 60_000,
  });
  await expect(workList).toContainText("Prepare the release notes", {
    timeout: 30_000,
  });

  await page
    .getByRole("button", { name: "Configuration Mode", exact: true })
    .click();
  const configuration = page.locator(
    'section[aria-label="Configuration Mode"]',
  );
  await configuration
    .getByRole("button", { name: "Custom field", exact: true })
    .click();
  const customFieldHost = configuration.getByRole("region", {
    exact: true,
    name: "Custom field",
  });
  await createWorkCustomField(page, customFieldHost, {
    name: "Target date",
    type: "Date",
  });
  await createWorkCustomField(page, customFieldHost, {
    name: "Estimate",
    type: "Number",
  });
  await createWorkCustomField(page, customFieldHost, {
    name: "Readiness",
    options: "Ready\nLater",
    type: "Single select",
  });

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
  await askWhenRunningForField(form, "Target date");
  await askWhenRunningForField(form, "Estimate");
  await askWhenRunningForField(form, "Readiness");
  await form.getByLabel("Related Work").selectOption("add");
  await form.getByRole("button", { name: "Save", exact: true }).click();

  await expect(
    page.getByRole("navigation", { name: "Project navigation" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Exit Configuration Mode", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await openWorkRecordFromKanbanList(page);
  const record = workList.getByRole("listitem").first();
  await record.getByRole("button", { name: "Start Work", exact: true }).click();

  const preview = page.getByRole("dialog", { name: "Preview Start Work" });
  const runtimeInputForm = preview.getByRole("form", {
    name: "Record Action inputs",
  });
  await expect(
    runtimeInputForm.getByRole("button", { name: "Preview changes" }),
  ).toBeDisabled();
  await expect(
    preview.getByRole("button", { name: "Apply", exact: true }),
  ).toHaveCount(0);
  await fillStartWorkRuntimeInputs(runtimeInputForm);
  await runtimeInputForm
    .getByRole("button", { name: "Preview changes" })
    .click();
  await expect(
    preview.getByRole("region", { name: "Runtime inputs selected" }),
  ).toContainText("2026-10-01");
  await expect(
    preview.getByRole("region", { name: "Runtime inputs selected" }),
  ).toContainText("5");
  await expect(
    preview.getByRole("region", { name: "Runtime inputs selected" }),
  ).toContainText("Ready");
  await expect(
    preview.getByRole("region", { name: "Runtime inputs selected" }),
  ).toContainText("Prepare the release notes");
  await expect(preview).toContainText("Not Started → In Progress");
  await expect(preview).toContainText("Not in Daily Focus → In Daily Focus");
  await expect(preview).toContainText("Empty → 2026-10-01");
  await expect(preview).toContainText("Target date");
  await expect(preview).toContainText("Estimate");
  await expect(preview).toContainText("Readiness");
  await expect(preview).toContainText("Empty → 5");
  await expect(preview).toContainText("Empty → Ready");
  await expect(preview).toContainText("Not related → Related");
  await expect(preview).toContainText(DAILY_FOCUS_DATE_LABEL);
  await preview.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(preview.getByRole("status")).toHaveText("Finalizing");
  await expect(preview.getByRole("status")).toHaveText("Start Work applied.", {
    timeout: 30_000,
  });

  await preview.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(preview.getByRole("status")).toHaveText(
    "Start Work was undone.",
    { timeout: 30_000 },
  );
  await preview.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    record.getByRole("combobox", { name: WORK_STATUS_COMBOBOX_NAME }),
  ).toHaveValue("Not Started");

  await page.reload();
  const persistedRecord = page
    .getByRole("list", { name: "Work list" })
    .getByRole("listitem")
    .first();
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
  const staleRuntimeInputForm = stalePreview.getByRole("form", {
    name: "Record Action inputs",
  });
  await fillStartWorkRuntimeInputs(staleRuntimeInputForm);
  await staleRuntimeInputForm
    .getByRole("button", { name: "Preview changes" })
    .click();
  await expect(stalePreview).toContainText("Not Started → In Progress");

  const competingPage = await context.newPage();
  await competingPage.goto(page.url());
  await competingPage
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await openWorkRecordFromKanbanList(competingPage);
  const competingRecord = competingPage
    .getByRole("list", { name: "Work list" })
    .getByRole("listitem")
    .first();
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
      .first()
      .getByRole("combobox", { name: WORK_STATUS_COMBOBOX_NAME }),
  ).toHaveValue("Blocked");
});
