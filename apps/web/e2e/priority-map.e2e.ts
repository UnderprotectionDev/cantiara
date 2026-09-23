import { expect, type Page, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const PROJECTS_URL_PATTERN = /\/projects$/;
const MAP_URL_PATTERN = /#priority-map$/;
const WORK_STATUS_COMBOBOX_NAME = /Status for/;

function workListItem(page: Page, title: string) {
  return page
    .getByRole("list", { name: "Work list" })
    .getByRole("listitem")
    .filter({ has: page.locator("p").filter({ hasText: title }) });
}

test.setTimeout(120_000);

test("compares Work on the Priority Map without writing position or status", async ({
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
  await context.addCookies([setup.cookie]);

  const projectName = "Priority Map Acceptance";
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill(projectName);
  await page.getByRole("button", { name: "Create Project" }).click();
  await expect(page).toHaveURL(PROJECTS_URL_PATTERN);
  await page.getByRole("link", { name: projectName, exact: true }).click();

  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();

  await page.getByRole("button", { name: "Configuration Mode" }).click();
  const configurationRegion = page.locator(
    'section[aria-label="Configuration Mode"]',
  );
  await configurationRegion
    .getByRole("button", { name: "Priority metrics", exact: true })
    .click();
  const priorityMetricsHost = configurationRegion.getByRole("region", {
    exact: true,
    name: "Priority metrics",
  });
  const metricForm = priorityMetricsHost.getByRole("form", {
    name: "Add priority metric",
  });

  async function addMetric(name: string) {
    await metricForm.getByLabel("Name").fill(name);
    await metricForm.getByLabel("Short description").fill(`${name} comparison`);
    const response = page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "POST" &&
        candidate.url().endsWith("/rpc/createPriorityMetric") &&
        candidate.ok(),
    );
    await metricForm.getByRole("button", { name: "Add metric" }).click();
    await response;
    await expect(
      priorityMetricsHost.getByRole("list", {
        name: "Project priority metrics",
      }),
    ).toContainText(name);
  }

  await addMetric("Customer value");
  await addMetric("Confidence");
  await addMetric("Effort estimate");
  await page.getByRole("button", { name: "Configuration Mode" }).click();

  async function createWork(title: string) {
    await page.getByRole("link", { name: "Create", exact: true }).click();
    await page.locator("#work-create").getByLabel("Title").fill(title);
    const finalizeResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith("/rpc/finalizeWorkDraft"),
    );
    await page
      .locator("#work-create")
      .getByRole("button", { name: "Create", exact: true })
      .click();
    expect((await finalizeResponse).ok()).toBe(true);
    await expect(workListItem(page, title)).toBeVisible();
  }

  const evaluatedTitle = "Recover interrupted checkout";
  const unevaluatedTitle = "Clarify cancellation behavior";
  await createWork(evaluatedTitle);
  await createWork(unevaluatedTitle);

  const evaluatedWork = workListItem(page, evaluatedTitle);
  await Promise.all(
    (
      [
        ["Customer value", "High"],
        ["Confidence", "Very high"],
      ] as const
    ).map(async ([metricName, rank]) => {
      const response = page.waitForResponse(
        (candidate) =>
          candidate.request().method() === "POST" &&
          candidate.url().endsWith("/rpc/setPriorityMetricValue") &&
          candidate.ok(),
      );
      await evaluatedWork.getByLabel(metricName).selectOption(rank);
      await response;
    }),
  );

  const positionWrites: string[] = [];
  page.on("request", (candidate) => {
    if (candidate.method() !== "POST") {
      return;
    }
    const operation = new URL(candidate.url()).pathname.split("/").at(-1);
    if (
      operation &&
      [
        "clearPriorityMetricValue",
        "setPriorityMetricValue",
        "updateWorkStatus",
      ].includes(operation)
    ) {
      positionWrites.push(operation);
    }
  });

  const workViews = page.getByRole("navigation", { name: "Work views" });
  await workViews.getByRole("link", { name: "Priority Map" }).click();
  await expect(page).toHaveURL(MAP_URL_PATTERN);
  await expect(
    page.getByRole("cell", {
      name: "Customer value: High; Confidence: Very high",
    }),
  ).toContainText(evaluatedTitle);
  const unevaluatedList = page.getByRole("list", { name: "Unevaluated Work" });
  await expect(unevaluatedList).toContainText(unevaluatedTitle);

  await page.getByLabel("Horizontal axis").selectOption({
    label: "Effort estimate",
  });
  await expect(unevaluatedList).toContainText(evaluatedTitle);
  await expect(positionWrites).toEqual([]);

  await page.getByRole("checkbox", { name: "Show evidence signals" }).check();
  const evaluatedMapCard = unevaluatedList
    .getByRole("listitem")
    .filter({ hasText: evaluatedTitle });
  await expect(
    evaluatedMapCard.getByText("Feedback: 0", { exact: true }),
  ).toBeVisible();
  await expect(
    evaluatedMapCard.getByText("Unique Contact: 0", { exact: true }),
  ).toBeVisible();
  await expect(
    evaluatedMapCard.getByText("Unique Company: 0", { exact: true }),
  ).toBeVisible();

  await evaluatedMapCard.getByText("Edit axis values", { exact: true }).click();
  const editResponse = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "POST" &&
      candidate.url().endsWith("/rpc/setPriorityMetricValue") &&
      candidate.ok(),
  );
  await evaluatedMapCard.getByLabel("Effort estimate").selectOption("High");
  await editResponse;
  await expect(
    page.getByRole("cell", {
      name: "Effort estimate: High; Confidence: Very high",
    }),
  ).toContainText(evaluatedTitle);
  expect(positionWrites).toEqual(["setPriorityMetricValue"]);

  await workViews.getByRole("link", { name: "Work", exact: true }).click();
  const persistedWork = workListItem(page, evaluatedTitle);
  await expect(persistedWork.getByLabel("Effort estimate")).toHaveValue("High");
  await expect(
    persistedWork.getByRole("combobox", {
      name: WORK_STATUS_COMBOBOX_NAME,
    }),
  ).toHaveValue("Not Started");
});
