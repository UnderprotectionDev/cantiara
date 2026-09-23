import { expect, type Locator, type Page, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const WORK_LIST_NAME = "Work list";
const UNSUPPORTED_BULK_EDIT_ACTION_PATTERN = /Import|New field/;

function workListItem(page: Page, title: string) {
  return page.locator(`ul[aria-label="${WORK_LIST_NAME}"] > li`).filter({
    has: page.locator("p").filter({ hasText: new RegExp(`${title}$`) }),
  });
}

function workStatusControl(work: Locator) {
  return work.locator('select[aria-label^="Status for"]');
}

test("previews and applies a status change only to selected Work", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=work-lifecycle`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([{ ...setup.cookie, expires: -1 }]);

  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Bulk Edit Project");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Bulk Edit Project", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();

  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Title").fill("Selected Work");
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(workListItem(page, "Selected Work")).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Title").fill("Unselected Work");
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  const selectedWork = workListItem(page, "Selected Work");
  const unselectedWork = workListItem(page, "Unselected Work");
  await expect(unselectedWork).toBeVisible({ timeout: 30_000 });

  await selectedWork.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Bulk Edit" }).click();
  const bulkEdit = page.getByRole("dialog", { name: "Bulk Edit" });
  await bulkEdit
    .getByRole("combobox", { name: "Status" })
    .selectOption("In Progress");
  await bulkEdit.getByRole("button", { name: "Preview", exact: true }).click();

  const preview = bulkEdit.getByRole("region", { name: "Preview" });
  await expect(preview).toContainText("Selected Work");
  await expect(preview).toContainText("Not Started");
  await expect(preview).toContainText("In Progress");
  await expect(workStatusControl(selectedWork)).toHaveValue("Not Started");
  await expect(workStatusControl(unselectedWork)).toHaveValue("Not Started");
  await expect(
    bulkEdit.getByRole("button", {
      name: UNSUPPORTED_BULK_EDIT_ACTION_PATTERN,
    }),
  ).toHaveCount(0);

  await bulkEdit.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(workStatusControl(selectedWork)).toHaveValue("In Progress", {
    timeout: 30_000,
  });
  await expect(workStatusControl(unselectedWork)).toHaveValue("Not Started");
  await expect(
    bulkEdit.getByRole("list", { name: "Bulk Edit results" }),
  ).toContainText("Succeeded");

  await page.reload();
  await expect(
    workStatusControl(workListItem(page, "Selected Work")),
  ).toHaveValue("In Progress");
  await expect(
    workStatusControl(workListItem(page, "Unselected Work")),
  ).toHaveValue("Not Started");
});

test("collects a closure result when Bulk Edit closes selected Work", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=work-lifecycle`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([{ ...setup.cookie, expires: -1 }]);

  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Bulk Close Project");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Bulk Close Project", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Title").fill("Work to close");
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();

  const work = workListItem(page, "Work to close");
  await expect(work).toBeVisible({ timeout: 30_000 });
  await work.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Bulk Edit" }).click();
  const bulkEdit = page.getByRole("dialog", { name: "Bulk Edit" });
  await bulkEdit
    .getByRole("combobox", { name: "Status" })
    .selectOption("Closed");
  await expect(bulkEdit.getByLabel("Closure result")).toBeVisible();
  await bulkEdit.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(bulkEdit.getByRole("region", { name: "Preview" })).toContainText(
    "Completed",
  );
  await expect(workStatusControl(work)).toHaveValue("Not Started");

  await bulkEdit.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(workStatusControl(work)).toHaveValue("Closed", {
    timeout: 30_000,
  });
  await expect(work.getByText("Completed", { exact: true })).toBeVisible();

  await page.reload();
  await expect(
    workListItem(page, "Work to close").getByText("Completed", { exact: true }),
  ).toBeVisible();
});
