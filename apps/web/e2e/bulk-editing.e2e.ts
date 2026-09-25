import { SUPPORT_REFERENCE_PATTERN } from "@cantiara/api/support-reference";
import { expect, type Locator, type Page, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const WORK_LIST_NAME = "Work list";
const UNSUPPORTED_BULK_EDIT_ACTION_PATTERN = /Import|New field/;
const BULK_EDIT_FIRST_PROGRESS_MAX_MS = 2000;

function workListItem(page: Page, title: string) {
  return page.locator(`ul[aria-label="${WORK_LIST_NAME}"] > li`).filter({
    has: page.locator("p").filter({ hasText: new RegExp(`${title}$`) }),
  });
}

function workStatusControl(work: Locator) {
  return work.locator('select[aria-label^="Status for"]');
}

function workTypeControl(work: Locator) {
  return work.locator('select[aria-label^="Type for"]');
}

test("previews and applies a status change only to selected Work", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=bulk-edit-basic`,
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

  const preview = bulkEdit.getByRole("region", {
    exact: true,
    name: "Preview",
  });
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

  const changedWork = workListItem(page, "Selected Work");
  await changedWork.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Bulk Edit" }).click();
  const undoDialog = page.getByRole("dialog", { name: "Bulk Edit" });
  await undoDialog
    .getByRole("combobox", { name: "Status" })
    .selectOption("Not Started");
  await undoDialog
    .getByRole("button", { name: "Preview", exact: true })
    .click();
  await undoDialog.getByRole("button", { name: "Apply", exact: true }).click();
  const undoResults = undoDialog.getByRole("list", {
    name: "Bulk Edit results",
  });
  await expect(undoResults).toContainText("Succeeded");
  const typeUpdate = page.waitForResponse(
    (response) =>
      response.url().includes("/rpc/updateWorkType") &&
      response.request().method() === "POST",
  );
  await expect(workStatusControl(changedWork)).toHaveValue("Not Started", {
    timeout: 30_000,
  });
  await workTypeControl(changedWork).selectOption("Bug");
  await typeUpdate;
  await expect(workTypeControl(changedWork)).toHaveValue("Bug");
  await undoResults.getByRole("button", { name: "Undo" }).click();
  await expect(workStatusControl(changedWork)).toHaveValue("In Progress", {
    timeout: 30_000,
  });
  await expect(workTypeControl(changedWork)).toHaveValue("Bug");
  await expect(undoResults).toContainText("Undone");

  await undoDialog.getByRole("button", { name: "Cancel" }).click();
  await page.route("**/rpc/updateWorkStatus", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "Bulk Edit" }).click();
  const failedDialog = page.getByRole("dialog", { name: "Bulk Edit" });
  await failedDialog
    .getByRole("combobox", { name: "Status" })
    .selectOption("Blocked");
  await failedDialog
    .getByRole("button", { name: "Preview", exact: true })
    .click();
  await failedDialog
    .getByRole("button", { name: "Apply", exact: true })
    .click();
  const failedResults = failedDialog.getByRole("list", {
    name: "Bulk Edit results",
  });
  await expect(failedResults).toContainText("Failed");
  await expect(failedResults).toContainText("Support reference unavailable.");
  await expect(failedResults).not.toContainText("Failed to fetch");
  await page.unroute("**/rpc/updateWorkStatus");
});

test("shows a stale Work conflict without hiding other selected results", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=bulk-edit-stale-results`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([{ ...setup.cookie, expires: -1 }]);

  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Bulk Stale Project");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Bulk Stale Project", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();

  async function createWork(title: string): Promise<void> {
    const createLink = page.getByRole("link", {
      name: "Create",
      exact: true,
    });
    await expect(createLink).toBeVisible({ timeout: 10_000 });
    await createLink.click();
    await page.getByLabel("Title").fill(title);
    await page
      .locator("#work-create")
      .getByRole("button", { name: "Create", exact: true })
      .click();
    await expect(workListItem(page, title)).toBeVisible({ timeout: 30_000 });
  }
  await createWork("Stale Work");
  await createWork("Current Work");

  const workUrl = page.url();
  const staleWork = workListItem(page, "Stale Work");
  const currentWork = workListItem(page, "Current Work");
  const staleWorkKey = await staleWork.locator("p span").innerText();
  const currentWorkKey = await currentWork.locator("p span").innerText();
  await expect(staleWork.getByRole("checkbox")).toHaveCount(1, {
    timeout: 5000,
  });
  await staleWork.getByRole("checkbox").check();
  await currentWork.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Bulk Edit" }).click();

  const bulkEdit = page.getByRole("dialog", { name: "Bulk Edit" });
  await bulkEdit
    .getByRole("combobox", { name: "Status" })
    .selectOption("In Progress");
  await bulkEdit.getByRole("button", { name: "Preview", exact: true }).click();

  const concurrentPage = await context.newPage();
  await concurrentPage.goto(workUrl);
  const concurrentStaleWork = workListItem(concurrentPage, "Stale Work");
  await expect(concurrentStaleWork).toBeVisible();
  await workStatusControl(concurrentStaleWork).selectOption("Blocked");
  await expect(workStatusControl(concurrentStaleWork)).toHaveValue("Blocked");

  await bulkEdit.getByRole("button", { name: "Apply", exact: true }).click();
  const progress = bulkEdit.getByRole("progressbar", { name: "Progress" });
  await expect(progress).toBeVisible({ timeout: 2000 });

  const results = bulkEdit.getByRole("list", { name: "Bulk Edit results" });
  await expect(results.locator("li")).toHaveCount(2);
  const resultRows = await results.locator("li > p").allTextContents();
  expect(resultRows).toContain(`${staleWorkKey}: Failed`);
  expect(resultRows).toContain(`${currentWorkKey}: Succeeded`);
  const staleResult = results.locator("li").filter({
    hasText: `${staleWorkKey}: Failed`,
  });
  await expect(staleResult.locator("code")).toHaveText(
    SUPPORT_REFERENCE_PATTERN,
  );
  await expect(workStatusControl(staleWork)).toHaveValue("Blocked");
  await expect(workStatusControl(currentWork)).toHaveValue("In Progress");

  await concurrentPage.close();
});

test("shows virtualized results for a large Work selection", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=bulk-edit-large-progress`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
    projectId: string;
    workCount: number;
  };
  expect(setup.workCount).toBeGreaterThan(128);
  await context.addCookies([{ ...setup.cookie, expires: -1 }]);

  await page.goto(`/projects/${setup.projectId}`);
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page
    .getByRole("list", { name: "List Work" })
    .getByRole("link", { name: "Open source record" })
    .first()
    .click();

  const workRows = page.locator('ul[aria-label="Work list"] > li');
  await expect(workRows).toHaveCount(setup.workCount, { timeout: 30_000 });
  const workCheckboxes = await workRows.getByRole("checkbox").all();
  await workCheckboxes.reduce(
    (previousCheck, checkbox) => previousCheck.then(() => checkbox.check()),
    Promise.resolve(),
  );
  await expect(
    page.getByText(`${setup.workCount} selected`, { exact: true }),
  ).toBeVisible();

  let releaseStatusWrite: () => void = () => undefined;
  let statusWriteCalls = 0;
  const statusWriteGate = new Promise<void>((resolve) => {
    releaseStatusWrite = resolve;
  });
  await page.route("**/rpc/updateWorkStatus", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    statusWriteCalls += 1;
    await statusWriteGate;
    await route.continue();
  });

  await page.getByRole("button", { name: "Bulk Edit" }).click();

  const bulkEdit = page.getByRole("dialog", { name: "Bulk Edit" });
  await bulkEdit
    .getByRole("combobox", { name: "Status" })
    .selectOption("In Progress");
  await bulkEdit.getByRole("button", { name: "Preview", exact: true }).click();

  const preview = bulkEdit.getByRole("region", {
    exact: true,
    name: "Preview",
  });
  const previewRecords = preview.getByRole("region", {
    name: "Bulk Edit preview records",
  });
  const previewList = previewRecords.getByRole("list", {
    name: "Bulk Edit preview records",
  });
  expect(await previewList.locator("li").count()).toBeLessThan(setup.workCount);
  await previewRecords.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const lastPreviewRecord = previewList.locator(
    `li[aria-posinset="${setup.workCount}"]`,
  );
  await expect(lastPreviewRecord).toContainText("Bulk Progress 130");

  await bulkEdit
    .getByRole("combobox", { name: "Status" })
    .selectOption("Not Started");
  await bulkEdit.getByRole("button", { name: "Preview", exact: true }).click();
  await page.evaluate(() => performance.mark("bulk-edit-apply-start"));
  const applyButton = bulkEdit.getByRole("button", {
    name: "Apply",
    exact: true,
  });
  await applyButton.evaluate((button) => {
    button.addEventListener(
      "click",
      () => {
        const cancelAfterFirstProgressBatch = () => {
          window.setTimeout(() => {
            const progressElement = document.querySelector<HTMLProgressElement>(
              'progress[aria-label="Progress"]',
            );
            if (!progressElement || progressElement.value < 16) {
              cancelAfterFirstProgressBatch();
              return;
            }
            if (progressElement.value > 64) {
              return;
            }
            const cancelButton = [...document.querySelectorAll("button")].find(
              (candidate) => candidate.textContent?.trim() === "Cancel",
            );
            cancelButton?.click();
          }, 0);
        };
        cancelAfterFirstProgressBatch();
      },
      { once: true },
    );
  });
  await applyButton.click();

  const progress = bulkEdit.getByRole("progressbar", { name: "Progress" });
  try {
    await expect(progress).toBeVisible({
      timeout: BULK_EDIT_FIRST_PROGRESS_MAX_MS,
    });
    await page.evaluate(() => performance.mark("bulk-edit-progress-visible"));
    const firstProgressDuration = await page.evaluate(
      () =>
        performance.measure(
          "bulk-edit-first-progress",
          "bulk-edit-apply-start",
          "bulk-edit-progress-visible",
        ).duration,
    );
    expect(
      firstProgressDuration,
      "Bulk Edit first progress must fit the p99 visibility budget",
    ).toBeLessThanOrEqual(BULK_EDIT_FIRST_PROGRESS_MAX_MS);
    await expect(progress).toHaveAttribute("value", String(setup.workCount), {
      timeout: 5000,
    });
    expect(statusWriteCalls).toBe(0);
  } finally {
    releaseStatusWrite();
  }

  const resultsRegion = bulkEdit.getByRole("region", {
    name: "Bulk Edit results",
  });
  const results = bulkEdit.getByRole("list", { name: "Bulk Edit results" });
  expect(await results.locator("li").count()).toBeLessThan(setup.workCount);
  await resultsRegion.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const lastResult = results.locator(`li[aria-posinset="${setup.workCount}"]`);
  await expect(lastResult).toContainText("Canceled");
  await expect(lastResult).toHaveAttribute(
    "aria-setsize",
    String(setup.workCount),
  );
});

test("collects a closure result when Bulk Edit closes selected Work", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=bulk-edit-closure`,
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
  await expect(
    bulkEdit.getByRole("region", { exact: true, name: "Preview" }),
  ).toContainText("Completed");
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

test("cancels queued status writes and restores progress after returning", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=bulk-edit-cancel`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([{ ...setup.cookie, expires: -1 }]);

  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Bulk Cancel Project");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Bulk Cancel Project", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();

  async function createQueuedWork(index: number): Promise<void> {
    if (index > 5) {
      return;
    }
    const title = `Queued Work ${index}`;
    await page.getByRole("link", { name: "Create", exact: true }).click();
    await page.getByLabel("Title").fill(title);
    await page
      .locator("#work-create")
      .getByRole("button", { name: "Create", exact: true })
      .click();
    await expect(workListItem(page, title)).toBeVisible({ timeout: 30_000 });
    await createQueuedWork(index + 1);
  }
  await createQueuedWork(1);

  await Promise.all(
    Array.from({ length: 5 }, (_, index) =>
      workListItem(page, `Queued Work ${index + 1}`)
        .getByRole("checkbox")
        .check(),
    ),
  );

  let releaseFinalization: () => void = () => undefined;
  let signalFirstFour: () => void = () => undefined;
  const finalizationGate = new Promise<void>((resolve) => {
    releaseFinalization = resolve;
  });
  const firstFourStarted = new Promise<void>((resolve) => {
    signalFirstFour = resolve;
  });
  let statusCalls = 0;
  await page.route("**/rpc/updateWorkStatus", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    statusCalls += 1;
    if (statusCalls === 4) {
      signalFirstFour();
    }
    if (statusCalls <= 4) {
      await finalizationGate;
      await route.fulfill({ response });
      return;
    }
    await route.fulfill({ response });
  });

  await page.getByRole("button", { name: "Bulk Edit" }).click();
  const bulkEdit = page.getByRole("dialog", { name: "Bulk Edit" });
  await bulkEdit
    .getByRole("combobox", { name: "Status" })
    .selectOption("In Progress");
  await bulkEdit.getByRole("button", { name: "Preview", exact: true }).click();
  await bulkEdit.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    bulkEdit.getByRole("progressbar", { name: "Progress" }),
  ).toBeVisible({ timeout: 2000 });
  await firstFourStarted;

  const cancel = bulkEdit.getByRole("button", { name: "Cancel" });
  await expect(cancel).toBeEnabled();
  await cancel.click();
  await expect(bulkEdit).toContainText("Finalizing");

  const workUrl = page.url();
  await page.goBack();
  await expect(page).not.toHaveURL(workUrl);
  releaseFinalization();
  await page.goForward();

  const restoredDialog = page.getByRole("dialog", { name: "Bulk Edit" });
  await expect(restoredDialog).toBeVisible();
  await expect(
    restoredDialog.getByRole("list", { name: "Bulk Edit results" }),
  ).toContainText("Canceled");
  await expect(
    restoredDialog.getByRole("progressbar", { name: "Progress" }),
  ).toHaveAttribute("value", "5");
  await Promise.all(
    Array.from({ length: 4 }, (_, index) =>
      expect(
        workStatusControl(workListItem(page, `Queued Work ${index + 1}`)),
      ).toHaveValue("In Progress"),
    ),
  );
  await expect(
    workStatusControl(workListItem(page, "Queued Work 5")),
  ).toHaveValue("Not Started");
});
