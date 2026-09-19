import { expect, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const PROJECTS_URL_PATTERN = /\/projects$/;
const PROJECT_DETAIL_URL_PATTERN = /\/projects\/[^/]+$/;
const TYPE_FIELD_PATTERN = /Type:/;
const WORK_HASH_PATTERN = /#work-/;

test.setTimeout(60_000);

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
  await page.getByRole("button", { name: "Create Work" }).click();

  await expect(
    page.getByText("Work PAY-1 created.", { exact: true }),
  ).toBeVisible();
  const firstWork = page.getByRole("listitem").filter({
    hasText: "PAY-1 Investigate payment failures",
  });
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
  const closedWork = page.getByRole("listitem").filter({
    hasText: "PAY-1 Investigate payment failures",
  });
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
  await page.getByRole("button", { name: "Create Work" }).click();
  await expect(
    page.getByText("Work PAY-2 created.", { exact: true }),
  ).toBeVisible();

  const duplicateWork = page.getByRole("listitem").filter({
    hasText: "PAY-2 Document the payment flow",
  });
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
  const workListItems = page
    .getByRole("list", { name: "Work list" })
    .getByRole("listitem");
  await expect(
    workListItems.filter({
      hasText: "PAY-1 Investigate payment failures",
    }),
  ).toBeVisible();
  await expect(
    workListItems.filter({
      hasText: "PAY-2 Document the payment flow",
    }),
  ).toContainText("Task");

  const secondWork = workListItems.filter({
    hasText: "PAY-2 Document the payment flow",
  });
  await secondWork.getByRole("button", { name: "Archive" }).click();
  await expect(secondWork).not.toBeVisible();
  await page.getByRole("button", { name: "Archived" }).click();
  const archivedWork = workListItems.filter({
    hasText: "PAY-2 Document the payment flow",
  });
  await expect(archivedWork).toContainText("Not Started");
  await archivedWork.getByRole("button", { name: "Unarchive" }).click();
  await expect(archivedWork).not.toBeVisible();
  await page.getByRole("button", { name: "Archived" }).click();
  await expect(
    workListItems.filter({
      hasText: "PAY-2 Document the payment flow",
    }),
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

  const sourceWork = page
    .getByRole("list", { name: "Work list" })
    .getByRole("listitem")
    .filter({ hasText: "PAY-1 Investigate payment failures" });
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
  const recreatedWork = page.getByRole("listitem").filter({
    hasText: "ORD-1 Investigate payment failures",
  });
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
