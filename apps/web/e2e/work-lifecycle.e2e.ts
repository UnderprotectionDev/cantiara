import { expect, type Page, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const PROJECTS_URL_PATTERN = /\/projects$/;
const PROJECT_DETAIL_URL_PATTERN = /\/projects\/[^/]+$/;
const TYPE_FIELD_PATTERN = /Type:/;
const WORK_HASH_PATTERN = /#work-/;
const WORK_STATUS_COMBOBOX_NAME = /Status for/;
const WORK_LIST_NAME = /^(?:Archived )?Work list$/;
const CHECKLIST_REGION_NAME = /Checklist for/;
const CHECKLIST_NEW_ITEM_LABEL = /New item for/;
const CHECKLIST_FIRST_ITEM_LABEL = /Item 1 for/;
const CHECKLIST_SECOND_ITEM_LABEL = /Item 2 for/;
const DOCUMENT_FALLBACK_CHECKBOX_NAME = /Mark Document the fallback/;
const CONFIRM_COPY_CHECKBOX_NAME = /Mark Confirm the final copy/;

function workListItem(page: Page, title: string) {
  return page
    .getByRole("list", { name: WORK_LIST_NAME })
    .getByRole("listitem")
    .filter({ has: page.locator("p").filter({ hasText: title }) });
}

const PREPARED_LAYOUT_MATRIX = {
  Bug: [
    "Observed/Expected Behavior",
    "Affected Releases",
    "Evidence",
    "GitHub & Tests",
  ],
  Feature: [
    "Problem/Opportunity",
    "Expected Outcome",
    "Evidence & Decisions",
    "Risks & Open Questions",
    "Included Work",
    "GitHub & Tests",
    "Target Release",
  ],
  Improvement: [
    "Current Situation",
    "Expected Outcome",
    "Evidence",
    "GitHub & Tests",
  ],
  Research: [
    "Research Question",
    "Sources & Evidence",
    "Decisions",
    "Related Work",
  ],
  Task: ["Description", "Dependencies", "GitHub & Tests", "Target Release"],
} as const;

const STARTER_CONFIGURATION_MATRIX = [
  "Blank Project",
  "Solo SaaS",
  "Open Source Library",
  "Mobile Application",
] as const;

test.setTimeout(60_000);

test("manages light checklist items without creating or closing Work", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const maximumDepthErrors: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Maximum update depth exceeded")) {
      maximumDepthErrors.push(message.text());
    }
  });
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=work-lifecycle`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([{ ...setup.cookie, expires: -1 }]);

  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Checklist Project");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Checklist Project", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Title").fill("Prepare release notes");
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();

  const parentWork = workListItem(page, "Prepare release notes");
  const checklist = parentWork.getByRole("region", {
    name: CHECKLIST_REGION_NAME,
  });
  await expect(checklist).toBeVisible({ timeout: 30_000 });
  await checklist.getByLabel(CHECKLIST_NEW_ITEM_LABEL).fill("Confirm the copy");
  await checklist.getByRole("button", { name: "Add item" }).click();
  await expect(checklist.getByLabel(CHECKLIST_FIRST_ITEM_LABEL)).toHaveValue(
    "Confirm the copy",
  );

  await checklist.getByLabel(CHECKLIST_NEW_ITEM_LABEL).fill("Publish the page");
  await checklist.getByRole("button", { name: "Add item" }).click();
  const secondItem = checklist.getByLabel(CHECKLIST_SECOND_ITEM_LABEL);
  await expect(secondItem).toHaveValue("Publish the page");
  await secondItem.fill("Document the fallback");
  await checklist.getByRole("button", { name: "Save item 2" }).click();
  await expect(secondItem).toHaveValue("Document the fallback");

  await checklist.getByRole("button", { name: "Move item 2 up" }).click();
  await expect(checklist.getByLabel(CHECKLIST_FIRST_ITEM_LABEL)).toHaveValue(
    "Document the fallback",
  );

  // An unsaved text edit rides along with the next checklist save instead of
  // being silently discarded by a sibling item action.
  await secondItem.fill("Confirm the final copy");
  await checklist
    .getByRole("checkbox", { name: "Mark Document the fallback complete" })
    .click();
  await expect(
    checklist.getByRole("checkbox", {
      name: DOCUMENT_FALLBACK_CHECKBOX_NAME,
    }),
  ).toBeChecked({ timeout: 15_000 });
  await checklist
    .getByRole("checkbox", { name: "Mark Confirm the final copy complete" })
    .click();
  await expect(
    checklist.getByRole("checkbox", { name: CONFIRM_COPY_CHECKBOX_NAME }),
  ).toBeChecked({ timeout: 15_000 });
  await expect(
    parentWork.getByRole("combobox", { name: WORK_STATUS_COMBOBOX_NAME }),
  ).toHaveValue("Not Started");
  await expect(page.locator('ul[aria-label="Work list"] > li')).toHaveCount(1);

  await page.reload();
  const persistedWork = workListItem(page, "Prepare release notes");
  const persistedChecklist = persistedWork.getByRole("region", {
    name: CHECKLIST_REGION_NAME,
  });
  await expect(
    persistedChecklist.getByLabel(CHECKLIST_FIRST_ITEM_LABEL),
  ).toHaveValue("Document the fallback");
  await expect(
    persistedChecklist.getByLabel(CHECKLIST_SECOND_ITEM_LABEL),
  ).toHaveValue("Confirm the final copy");
  await expect(persistedChecklist.getByRole("checkbox")).toHaveCount(2);
  await expect(persistedChecklist.getByRole("checkbox").first()).toBeChecked();
  await expect(persistedChecklist.getByRole("checkbox").last()).toBeChecked();
  await persistedChecklist
    .getByRole("button", { name: "Delete item 2" })
    .click();
  await expect(persistedChecklist.getByRole("checkbox")).toHaveCount(1);
  expect(maximumDepthErrors).toEqual([]);
});

test("previews and converts a checklist item into independent Work", async ({
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
  await page.getByLabel("Project Name").fill("Conversion Project");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Conversion Project", exact: true })
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

  const sourceWork = workListItem(page, "Prepare the release");
  const checklist = sourceWork.getByRole("region", {
    name: CHECKLIST_REGION_NAME,
  });
  await expect(checklist).toBeVisible({ timeout: 30_000 });
  await checklist
    .getByLabel(CHECKLIST_NEW_ITEM_LABEL)
    .fill("Publish the release");
  await checklist.getByRole("button", { name: "Add item" }).click();
  await expect(checklist.getByLabel(CHECKLIST_FIRST_ITEM_LABEL)).toHaveValue(
    "Publish the release",
  );

  await checklist
    .getByRole("button", {
      name: "Convert to independent Work",
      exact: true,
    })
    .click();
  const conversionPreview = checklist.getByRole("status", {
    name: "Convert to independent Work",
  });
  await expect(conversionPreview).toBeVisible();
  await expect(conversionPreview).toContainText("Title: Publish the release");
  await expect(conversionPreview).toContainText("Project: Conversion Project");
  await expect(conversionPreview).toContainText("Start status: Not Started");
  await expect(conversionPreview).toContainText("Origin Location:");
  await expect(page.locator('ul[aria-label="Work list"] > li')).toHaveCount(1);

  await conversionPreview
    .getByRole("button", { name: "Confirm convert", exact: true })
    .click();

  await expect(page.locator('ul[aria-label="Work list"] > li')).toHaveCount(2);
  const convertedLink = checklist.getByRole("link", {
    name: "CON-2 — Publish the release",
  });
  await expect(convertedLink).toBeVisible({ timeout: 30_000 });
  const convertedWork = page
    .locator('ul[aria-label="Work list"] > li')
    .filter({ hasText: "CON-2" })
    .last();
  await expect(
    convertedWork.getByRole("combobox", { name: WORK_STATUS_COMBOBOX_NAME }),
  ).toHaveValue("Not Started");
  await expect(
    convertedWork.getByRole("region", { name: "Relations" }),
  ).toContainText("Derived");
  await expect(convertedWork).toContainText("Prepare the release");
});

test("shows the same progressive Work Context Card layouts for five types across four Starter Configurations", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=work-lifecycle`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([{ ...setup.cookie, expires: -1 }]);

  let projectNumber = 0;
  for (const starterConfiguration of STARTER_CONFIGURATION_MATRIX) {
    projectNumber += 1;
    const projectName = `Context ${projectNumber} ${starterConfiguration}`;

    // biome-ignore lint/performance/noAwaitInLoops: Each Starter Configuration needs its own sequential browser journey and project state.
    await page.goto("/projects/new");
    await page.getByLabel("Project Name").fill(projectName);
    await page
      .getByLabel("Starter Configuration")
      .selectOption(starterConfiguration);
    await page.getByRole("button", { name: "Create Project" }).click();
    await expect(page).toHaveURL(PROJECTS_URL_PATTERN);
    await page.getByRole("link", { name: projectName, exact: true }).click();
    await expect(page).toHaveURL(PROJECT_DETAIL_URL_PATTERN);
    await page
      .getByRole("navigation", { name: "Project navigation" })
      .getByRole("link", { name: "Work", exact: true })
      .click();

    for (const [workType, sections] of Object.entries(PREPARED_LAYOUT_MATRIX)) {
      const title = `${starterConfiguration} ${workType} context`;
      // biome-ignore lint/performance/noAwaitInLoops: Each Work type must be created and checked against the same live list before the next type changes it.
      await page.getByRole("link", { name: "Create", exact: true }).click();
      const createForm = page.locator("#work-create");
      await createForm.getByLabel("Title").fill(title);
      await createForm.getByLabel("Type").selectOption(workType);
      await createForm
        .getByRole("button", { name: "Create", exact: true })
        .click();

      const record = workListItem(page, title);
      await expect(record).toBeVisible();
      const card = record.locator('[data-work-context-card="true"]');
      await expect(card).toBeVisible();
      await expect(card.getByText("Title", { exact: true })).toBeVisible();
      await expect(card.getByText("Type", { exact: true })).toBeVisible();
      await expect(card.getByText("Status", { exact: true })).toBeVisible();
      await expect(card.getByText("Planning", { exact: true })).toBeVisible();
      await expect(
        card.getByRole("button", { name: "Add Context", exact: true }),
      ).toBeVisible();
      await expect(
        card.getByText("Nothing here yet.", { exact: true }),
      ).toHaveCount(1);

      for (const section of sections) {
        // biome-ignore lint/performance/noAwaitInLoops: Each Add Context click must reveal the prior section before the next progressive section can be asserted.
        await card
          .getByRole("button", { name: "Add Context", exact: true })
          .click();
        await expect(
          card.getByRole("heading", { name: section, level: 5 }),
        ).toBeVisible();
        await expect(
          card.getByText("Nothing here yet.", { exact: true }).last(),
        ).toBeVisible();
      }

      await expect(
        card.getByRole("button", { name: "Add Context", exact: true }),
      ).toHaveCount(0);
      await expect(
        record.getByRole("combobox", { name: WORK_STATUS_COMBOBOX_NAME }),
      ).toBeEnabled();
    }
  }
});

test("opens the exact Priority Foundations count drilldown", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=work-lifecycle`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([{ ...setup.cookie, expires: -1 }]);

  await page.route("**/rpc/relations", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const body = (await response.json()) as {
      json?: unknown[];
      meta?: unknown;
    };
    if (!body.json) {
      await route.fulfill({ response, json: body });
      return;
    }
    const input = route.request().postDataJSON() as {
      json?: { recordId?: string };
    };
    const recordId = input.json?.recordId;
    if (!recordId) {
      await route.fulfill({ response, json: body });
      return;
    }
    body.json = [
      {
        blockingHistory: [],
        blockingStatus: "Active",
        createdAt: "2026-01-01T00:00:00.000Z",
        direction: "incoming",
        id: "priority-foundations-blocker-relation",
        inverseLabel: "Blocked by",
        kind: "Blocks",
        label: "Blocked by",
        revision: 1,
        source: {
          broken: null,
          key: "BLK-1",
          label: "BLK-1",
          openPath: "/projects/priority-project#work-blocker-1",
          originPosition: null,
          projectId: "priority-project",
          recordId: "blocker-1",
          recordType: "Work",
          status: "In Progress",
          title: "Wait for provider access",
          workType: "Research",
        },
        target: {
          broken: null,
          key: "TARGET-1",
          label: "TARGET-1",
          originPosition: null,
          projectId: "priority-project",
          recordId,
          recordType: "Work",
          status: "Not Started",
          title: "Review checkout evidence",
          workType: "Task",
        },
      },
    ];
    await route.fulfill({ response, json: body });
  });

  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Priority Foundations Project");
  await page.getByRole("button", { name: "Create Project" }).click();
  await expect(page).toHaveURL(PROJECTS_URL_PATTERN);
  await page
    .getByRole("link", { name: "Priority Foundations Project", exact: true })
    .click();
  await expect(page).toHaveURL(PROJECT_DETAIL_URL_PATTERN);
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();

  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Title").fill("Review checkout evidence");
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();

  const targetWork = workListItem(page, "Review checkout evidence");
  const card = targetWork.locator('[data-work-context-card="true"]');
  const count = card.getByRole("button", {
    name: "Show Blocked by source records (1)",
  });
  await expect(count).toBeVisible({ timeout: 20_000 });
  await expect(count).toHaveAttribute("aria-expanded", "false");

  await count.click();

  await expect(count).toHaveAttribute("aria-expanded", "true");
  const sources = card.getByRole("list", {
    name: "Blocked by source records",
  });
  await expect(sources).toContainText("BLK-1 Wait for provider access");
  await expect(
    sources.getByRole("link", { name: "Open source record" }),
  ).toHaveAttribute("href", "/projects/priority-project#work-blocker-1");
});

test("creates Work with a Project key, type, and protected start status", async ({
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
  await page.getByLabel("Project Name").fill("Payment App");
  await page.getByRole("button", { name: "Create Project" }).click();
  await expect(page).toHaveURL(PROJECTS_URL_PATTERN);
  await page.getByRole("link", { name: "Payment App", exact: true }).click();
  await expect(page).toHaveURL(PROJECT_DETAIL_URL_PATTERN);

  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Title").fill("Investigate payment failures");
  await page.getByLabel("Type").selectOption("Research");
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();

  await expect(
    page.getByText("Work PAY-1 created.", { exact: true }),
  ).toBeVisible();
  const firstWork = workListItem(page, "PAY-1 Investigate payment failures");
  await expect(firstWork).toContainText("Research");
  await expect(firstWork).toContainText("Not Started");

  const status = firstWork.getByRole("combobox", { name: "Status for PAY-1" });
  await status.selectOption("In Progress");
  await expect(status).toBeEnabled({ timeout: 20_000 });
  await expect(status).toHaveValue("In Progress");
  await status.selectOption("Blocked");
  await expect(status).toBeEnabled({ timeout: 20_000 });
  await expect(status).toHaveValue("Blocked");

  await status.selectOption("Closed");
  await expect(firstWork.getByLabel("Close PAY-1")).toBeVisible();
  await firstWork.getByRole("button", { name: "Return to work" }).click();
  await expect(status).toHaveValue("Blocked");

  await status.selectOption("Closed");
  await firstWork
    .getByRole("combobox", { name: "Closure result for PAY-1" })
    .selectOption("Abandoned");
  await firstWork.getByLabel("Reason for PAY-1").fill("No longer needed");
  await firstWork.getByRole("button", { name: "Close", exact: true }).click();
  await expect(firstWork.getByLabel("Close PAY-1")).toBeHidden({
    timeout: 20_000,
  });
  await expect(status).toHaveValue("Closed");
  await expect(firstWork).toContainText("Abandoned");
  await expect(firstWork).toContainText("No longer needed");

  await page.reload();
  const closedWork = workListItem(page, "PAY-1 Investigate payment failures");
  await expect(closedWork).toContainText("Abandoned", { timeout: 20_000 });
  await closedWork
    .getByRole("combobox", { name: "Status for PAY-1" })
    .selectOption("In Progress");
  await expect(closedWork.getByLabel("Reopen PAY-1")).toBeVisible();
  await closedWork.getByRole("button", { name: "Confirm reopen" }).click();
  await expect(closedWork.getByLabel("Reopen PAY-1")).toBeHidden({
    timeout: 15_000,
  });
  await expect(
    closedWork.getByRole("combobox", { name: "Status for PAY-1" }),
  ).toHaveValue("In Progress");
  await expect(closedWork).not.toContainText("Abandoned");

  await closedWork
    .getByRole("combobox", { name: "Type for PAY-1" })
    .selectOption("Bug");
  await expect(closedWork).toContainText("Bug");
  await closedWork
    .getByRole("combobox", { name: "Type for PAY-1" })
    .selectOption("Feature");
  await expect(closedWork.getByLabel("Impact preview")).toBeVisible();
  await closedWork.getByRole("button", { name: "Confirm type change" }).click();
  await expect(closedWork).toContainText("Feature");

  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Title").fill("Document the payment flow");
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(
    page.getByText("Work PAY-2 created.", { exact: true }),
  ).toBeVisible();

  const duplicateWork = workListItem(page, "PAY-2 Document the payment flow");
  await duplicateWork
    .getByRole("button", { name: "Merge as duplicate" })
    .click();
  const merge = duplicateWork.getByRole("region", {
    name: "Merge PAY-2",
  });
  await merge
    .getByLabel("Surviving record")
    .selectOption({ label: "PAY-1 — Investigate payment failures" });
  await merge.getByRole("button", { name: "Preview" }).click();
  await expect(merge.getByLabel("Merge Preview")).toContainText(
    "Surviving record: PAY-1",
  );
  await Promise.all(
    ["Title", "Type", "Status"].map((field) =>
      merge
        .getByLabel(`${field} resolution for PAY-2`)
        .selectOption("surviving"),
    ),
  );
  await merge.getByRole("button", { name: "Confirm" }).click();
  await expect(duplicateWork).not.toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByRole("status").filter({ hasText: "Origin: PAY-2 → PAY-1" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(duplicateWork).toBeVisible({ timeout: 20_000 });

  await page.reload();
  await expect(
    workListItem(page, "PAY-1 Investigate payment failures"),
  ).toBeVisible();
  await expect(
    workListItem(page, "PAY-2 Document the payment flow"),
  ).toContainText("Task");

  const secondWork = workListItem(page, "PAY-2 Document the payment flow");
  await secondWork.getByRole("button", { name: "Archive" }).click();
  await expect(secondWork).not.toBeVisible();
  await page.getByRole("button", { name: "Archived" }).click();
  const archivedWork = workListItem(page, "PAY-2 Document the payment flow");
  await expect(archivedWork).toContainText("Not Started");
  await archivedWork.getByRole("button", { name: "Unarchive" }).click();
  await expect(archivedWork).not.toBeVisible();
  await page.getByRole("button", { name: "Archived" }).click();
  await expect(
    workListItem(page, "PAY-2 Document the payment flow"),
  ).toContainText("PAY-2");

  await page.goto("/projects");
  const project = page.getByRole("listitem").filter({ hasText: "Payment App" });
  await expect(
    project.getByRole("textbox", { name: "Short code" }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Create Project" }).click();
  await page.getByLabel("Project Name").fill("Orders");
  await page.getByRole("button", { name: "Create Project" }).click();
  const ordersLink = page.getByRole("link", { name: "Orders", exact: true });
  await expect(ordersLink).toBeVisible();
  const ordersProjectUrl = await ordersLink.getAttribute("href");
  if (!ordersProjectUrl) {
    throw new Error("Orders project link did not expose an href.");
  }
  await page.getByRole("link", { name: "Payment App", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();

  const sourceWork = workListItem(page, "PAY-1 Investigate payment failures");
  await sourceWork
    .getByRole("button", { name: "Recreate in another Project" })
    .click();
  const recreate = sourceWork.getByRole("region", { name: "Recreate PAY-1" });
  await recreate.getByLabel("Project").selectOption({ label: "Orders" });
  await recreate.getByRole("button", { name: "Preview" }).click();
  await expect(recreate.getByLabel("Recreate preview")).toContainText(
    "Target Project: Orders",
  );
  await expect(recreate.getByText("Title:", { exact: false })).toBeVisible();
  await expect(recreate.getByText("Type:", { exact: false })).toBeVisible();
  await expect(
    recreate.getByText("Description:", { exact: false }),
  ).toBeVisible();
  await expect(
    recreate.getByText("Checklist:", { exact: false }),
  ).toBeVisible();
  await expect(
    recreate.getByText("No relations yet.", { exact: true }),
  ).toBeVisible();
  await recreate.getByRole("checkbox", { name: TYPE_FIELD_PATTERN }).uncheck();
  await recreate.getByRole("button", { name: "Confirm" }).click();
  await expect(
    recreate.getByText("Work ORD-1 was recreated.", { exact: true }),
  ).toBeVisible();
  await expect(sourceWork).toContainText("Feature");
  await expect(sourceWork).toContainText("Not Started");

  await page.goto(ordersProjectUrl);
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  const recreatedWork = workListItem(
    page,
    "ORD-1 Investigate payment failures",
  );
  await expect(recreatedWork).toContainText("Task");
  await expect(recreatedWork).toContainText("Not Started");
  await expect(recreatedWork).toContainText("Origin: PAY-1");
});

test("walks the read-only Scope Tree and opens a source record", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=scope-tree`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
    projectId: string;
  };
  await context.addCookies([{ ...setup.cookie, expires: -1 }]);

  await page.goto(`/projects/${setup.projectId}`);
  const scopeTree = page.locator('[data-scope-tree-read-only="true"]');
  await expect(
    scopeTree.getByRole("heading", { name: "Scope Tree" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(scopeTree).toContainText("Scope Tree Project");
  await expect(scopeTree).toContainText("Checkout Feature");
  await expect(scopeTree).toContainText("Verify provider callback");
  await expect(scopeTree).toContainText("Blocked by");
  await expect(scopeTree).toContainText("Wait for provider access");
  await expect(scopeTree).toContainText("Private beta");

  const nonGetRequests: string[] = [];
  page.on("request", (pageRequest) => {
    if (pageRequest.method() !== "GET") {
      nonGetRequests.push(pageRequest.url());
    }
  });
  const nonGetRequestCountBeforeDrag = nonGetRequests.length;
  await scopeTree.locator("li").first().dragTo(scopeTree.locator("li").last());
  expect(nonGetRequests).toHaveLength(nonGetRequestCountBeforeDrag);

  const featureDetails = scopeTree.locator("details").nth(1);
  await featureDetails.locator("summary").click();
  await expect(
    scopeTree.getByText("Verify provider callback", { exact: true }),
  ).toBeHidden();
  await featureDetails.locator("summary").click();
  await scopeTree
    .getByRole("link", { name: "Open source record" })
    .last()
    .click();
  await expect(page).toHaveURL(WORK_HASH_PATTERN);
  expect(
    await scopeTree.locator('[draggable="false"]').count(),
  ).toBeGreaterThan(0);
});

test("shows Used in groups and opens cross-Project source records", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=used-in`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
    projectId: string;
    usedInSourceProjectId: string;
    usedInSourceWorkId: string;
  };
  await context.addCookies([{ ...setup.cookie, expires: -1 }]);

  await page.goto(`/projects/${setup.projectId}`);
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  const targetWork = workListItem(page, "Target record");
  await expect(targetWork).toBeVisible({ timeout: 20_000 });
  const relations = targetWork.getByRole("region", { name: "Relations" });
  await expect(
    relations.getByRole("heading", { name: "Used in", exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    relations.getByRole("heading", { name: "Relations", exact: true }),
  ).toHaveCount(1);
  await expect(
    relations.getByRole("heading", { name: "Usage links", exact: true }),
  ).toBeVisible();

  const sourceLinks = relations.getByRole("link", {
    name: "Open source record",
  });
  await expect(sourceLinks).toHaveCount(2);
  await expect
    .poll(() =>
      sourceLinks.evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).getAttribute("href")),
      ),
    )
    .toEqual([
      `/projects/${setup.usedInSourceProjectId}#work-${setup.usedInSourceWorkId}`,
      `/projects/${setup.usedInSourceProjectId}#work-${setup.usedInSourceWorkId}`,
    ]);
});
