// biome-ignore-all lint/performance/useTopLevelRegex: Playwright locators use local regex patterns for visible copy.
// biome-ignore-all lint/performance/noAwaitInLoops: Each presentation is verified before selecting the next.
import { expect, type Page, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

async function createWork(page: Page, title: string) {
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Title").fill(title);
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(
    page.locator("#work-create").getByText(/Work .* created\./),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.locator("#work").getByText(title, { exact: true }).first(),
  ).toBeVisible();
}

test("Backlog drag persists its own order across alternate presentations and a session reorder", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const setupResponse = await request.get(
    `${serverUrl}/__e2e/setup?fixture=project-shell`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([{ ...setup.cookie, expires: -1 }]);

  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Manual Order Acceptance");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Manual Order Acceptance", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await page.getByRole("button", { name: "Configuration Mode" }).click();
  const configuration = page.locator(
    'section[aria-label="Configuration Mode"]',
  );
  await configuration.getByRole("button", { name: "Priority metrics" }).click();
  const metricForm = configuration.getByRole("form", {
    name: "Add priority metric",
  });
  await metricForm.getByLabel("Name").fill("Customer value");
  await metricForm
    .getByLabel("Short description")
    .fill("Customer value comparison");
  const metricCreated = page.waitForResponse(
    (response) =>
      response.url().endsWith("/rpc/createPriorityMetric") && response.ok(),
  );
  await metricForm.getByRole("button", { name: "Add metric" }).click();
  await metricCreated;
  await page.getByRole("button", { name: "Exit Configuration Mode" }).click();
  await createWork(page, "Alpha Work");
  await createWork(page, "Beta Work");
  const alphaPriority = page.getByRole("region", {
    name: "Priority metrics for MAN-1",
  });
  const prioritySaved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/rpc/setPriorityMetricValue") && response.ok(),
  );
  await alphaPriority.getByLabel("Customer value").selectOption("High");
  await prioritySaved;

  await page.getByRole("link", { name: "Backlog", exact: true }).click();
  const backlog = page.getByRole("list", { name: "Backlog" });
  const items = backlog.locator(":scope > li");
  await expect(items).toHaveText([/Alpha Work/, /Beta Work/]);
  await backlog
    .getByRole("button", { name: /Drag Beta Work/ })
    .dragTo(items.first(), { targetPosition: { x: 12, y: 4 }, steps: 20 });
  await expect(items).toHaveText([/Beta Work/, /Alpha Work/]);

  for (const presentation of ["Priority", "Date", "Field"] as const) {
    await page.getByLabel("Backlog sort").selectOption({ label: presentation });
    if (presentation === "Priority") {
      await page
        .getByLabel("Priority criterion")
        .selectOption({ label: "Customer value" });
      await expect(items).toHaveText([/Alpha Work/, /Beta Work/]);
    }
    if (presentation === "Field") {
      await expect(items).toHaveText([/Alpha Work/, /Beta Work/]);
      await page.getByRole("button", { name: "Save presentation" }).click();
      await expect(
        page.getByText("Saved presentation: Field · Title"),
      ).toBeVisible();
      await page
        .getByLabel("Field to sort by")
        .selectOption({ label: "Status" });
    }
    await page
      .getByLabel("Backlog sort")
      .selectOption({ label: "Manual order" });
    await expect(items).toHaveText([/Beta Work/, /Alpha Work/]);
  }
  await page.reload();
  await expect(items).toHaveText([/Beta Work/, /Alpha Work/]);
  await page.getByRole("button", { name: "Use saved presentation" }).click();
  await expect(items).toHaveText([/Alpha Work/, /Beta Work/]);
  await page.getByLabel("Backlog sort").selectOption({ label: "Manual order" });
  await expect(items).toHaveText([/Beta Work/, /Alpha Work/]);

  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Work views" })
    .getByRole("button", { name: "List", exact: true })
    .click();
  const workList = page
    .getByRole("region", { name: "List" })
    .getByRole("list", { name: "List Work" })
    .locator(":scope > li");
  await expect(workList.first()).toContainText("Alpha Work");
  await expect(workList.last()).toContainText("Beta Work");
  await page.getByLabel("Session name").fill("Order comparison");
  await page.getByRole("checkbox", { name: /Alpha Work/ }).check();
  await page.getByRole("checkbox", { name: /Beta Work/ }).check();
  await page
    .getByRole("button", { name: "Create Prioritization Session" })
    .click();
  const session = page.getByRole("article", { name: "Order comparison" });
  await session
    .getByRole("button", { name: /Move .* up/ })
    .last()
    .click();
  const sessionItems = session
    .getByRole("list", { name: "Order comparison Session order" })
    .locator(":scope > li");
  await expect(sessionItems).toHaveText([/Beta Work/, /Alpha Work/]);

  await page.getByRole("button", { name: "Board", exact: true }).click();
  const notStarted = page.locator('[data-kanban-column="Not Started"]');
  const inProgress = page.locator('[data-kanban-column="In Progress"]');
  for (const title of ["Beta Work", "Alpha Work"]) {
    await notStarted
      .locator("article")
      .filter({ hasText: title })
      .getByRole("button", { name: /^Move / })
      .dragTo(inProgress);
    await expect(
      inProgress.locator("article").filter({ hasText: title }),
    ).toBeVisible();
  }
  await expect(inProgress.locator("article")).toHaveText([
    /Alpha Work/,
    /Beta Work/,
  ]);
  await expect(sessionItems).toHaveText([/Beta Work/, /Alpha Work/]);

  await page.getByRole("link", { name: "Backlog", exact: true }).click();
  await expect(items).toHaveText([/Beta Work/, /Alpha Work/]);
  await page.reload();
  await expect(items).toHaveText([/Beta Work/, /Alpha Work/]);
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await expect(sessionItems).toHaveText([/Beta Work/, /Alpha Work/]);
  await page.getByRole("link", { name: "Backlog", exact: true }).click();

  const alphaHandle = backlog.getByRole("button", { name: "Drag Alpha Work" });
  await alphaHandle.focus();
  await alphaHandle.press("Space");
  await alphaHandle.press("ArrowUp");
  await expect(page.getByRole("status")).toContainText(
    "Alpha Work is over Beta Work.",
  );
  await alphaHandle.press("Space");
  await expect(items).toHaveText([/Alpha Work/, /Beta Work/]);
  await page.reload();
  await expect(items).toHaveText([/Alpha Work/, /Beta Work/]);
});
