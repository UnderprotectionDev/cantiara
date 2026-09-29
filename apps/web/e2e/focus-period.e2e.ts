import { expect, test } from "@playwright/test";

const FOCUS_PERIOD_WORK_NAME = /Prepare Focus Period release/;
const ABANDON_WORK_NAME = /Retire Focus Period draft/;
const SOURCE_PERIOD_NAME = /Ship the release/;
const LATER_PERIOD_NAME = /Later window/;

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

test("creates a 1–8 week Focus Period and changes membership without changing Work status", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const setupResponse = await request.get(
    `${serverUrl}/__e2e/setup?fixture=project-shell`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([{ ...setup.cookie, expires: -1 }]);

  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Focus Period Project");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Focus Period Project", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Title").fill("Prepare Focus Period release");
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(
    page.getByText("Prepare Focus Period release").first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Title").fill("Retire Focus Period draft");
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(
    page.getByText("Retire Focus Period draft").first(),
  ).toBeVisible();

  await page.goto("/focus-periods");
  await expect(page.getByText("No Focus Period yet.")).toBeVisible();
  await page.getByLabel("Purpose").fill("Ship the release");
  await page.getByLabel("Start date").fill("2099-01-01");
  await page.getByLabel("End date").fill("2099-01-06");
  await page.getByRole("button", { name: "Create Focus Period" }).click();
  await expect(page.getByText("Focus Period must be 1–8 weeks.")).toBeVisible();

  const start = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Start date").fill(start);
  await page.getByLabel("End date").fill(end);
  await page.getByRole("button", { name: "Create Focus Period" }).click();
  const detail = page.getByRole("region", { name: "Ship the release" });
  await expect(detail).toContainText("Active");
  await detail
    .getByLabel("Select Work", { exact: true })
    .selectOption({ index: 1 });
  await detail.getByRole("button", { name: "Add Work" }).click();
  await expect(detail).toContainText("Prepare Focus Period release");
  await detail.getByLabel("Select Work", { exact: true }).selectOption({
    label: "Focus Period Project · FOC-2 · Retire Focus Period draft",
  });
  await detail.getByRole("button", { name: "Add Work" }).click();
  await expect(
    detail.getByRole("link", { name: ABANDON_WORK_NAME }),
  ).toBeVisible();
  await expect(detail).toContainText("Prepare Focus Period release");
  await expect(detail).toContainText("Not Started");
  await page.getByLabel("Purpose").fill("Later window");
  await page.getByLabel("Start date").fill(start);
  await page.getByLabel("End date").fill(end);
  await page.getByRole("button", { name: "Create Focus Period" }).click();
  const laterWindow = page.getByRole("region", { name: "Later window" });
  await expect(laterWindow).toContainText("Active");
  await laterWindow
    .getByLabel("Select Work", { exact: true })
    .selectOption({ index: 1 });
  await expect(
    laterWindow.getByRole("button", { name: "Move", exact: true }),
  ).toBeVisible();
  await laterWindow.getByRole("button", { name: "Move", exact: true }).click();
  await expect(laterWindow).toContainText("Prepare Focus Period release");
  await page.getByRole("button", { name: SOURCE_PERIOD_NAME }).click();
  await expect(detail).toContainText("Retire Focus Period draft");
  await expect(
    detail.getByRole("link", { name: FOCUS_PERIOD_WORK_NAME }),
  ).toHaveCount(0);
  await detail
    .getByLabel("Select Work", { exact: true })
    .selectOption({ index: 1 });
  await expect(
    detail.getByRole("button", { name: "Move", exact: true }),
  ).toBeVisible();
  await detail.getByRole("button", { name: "Move", exact: true }).click();
  await expect(detail).toContainText("Prepare Focus Period release");
  await page.getByRole("button", { name: LATER_PERIOD_NAME }).click();
  await expect(laterWindow).toContainText("No Work in this Focus Period.");
  await page.getByRole("button", { name: SOURCE_PERIOD_NAME }).click();
  const dependencies = detail.getByRole("region", { name: "Dependencies" });
  await expect(
    dependencies.getByText("No dependencies in this Focus Period."),
  ).not.toBeVisible();
  await dependencies.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(
    dependencies.getByText("No dependencies in this Focus Period."),
  ).toBeVisible();
  await page.keyboard.press("Space");
  await expect(
    dependencies.getByText("No dependencies in this Focus Period."),
  ).not.toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: SOURCE_PERIOD_NAME }).click();
  await expect(
    page.getByRole("region", { name: "Ship the release" }),
  ).toContainText("Prepare Focus Period release");
  await page
    .getByRole("region", { name: "Ship the release" })
    .getByRole("button", { name: "Close" })
    .click();
  await expect(
    page.getByRole("region", { name: "Still-open Work" }),
  ).toContainText("Prepare Focus Period release");
  await page
    .getByRole("region", { name: "Still-open Work" })
    .getByRole("button", { name: "Close" })
    .click();
  await expect(
    page.getByRole("region", { name: "Ship the release" }),
  ).toContainText("Closed");
  const closeComparison = page
    .getByRole("region", { name: "Ship the release" })
    .getByRole("region", { name: "Close comparison" });
  await expect(
    closeComparison
      .getByText("Added later", { exact: true })
      .locator("..")
      .locator("dd"),
  ).toHaveText("2");
  await expect(
    page.getByRole("region", { name: "Ship the release" }),
  ).toContainText("Not Started");
  const closedDetail = page.getByRole("region", { name: "Ship the release" });
  await closedDetail.getByLabel("Keep", { exact: true }).fill("Pair early");
  await closedDetail
    .getByLabel("Try next", { exact: true })
    .fill("Ship smaller");
  await closedDetail.getByRole("button", { name: "Save evaluation" }).click();
  await expect(closedDetail).toContainText("Pair early");
  await closedDetail.getByLabel("Learning source").selectOption("Try next");
  await closedDetail.getByLabel("Project").selectOption({
    label: "Focus Period Project",
  });
  await closedDetail
    .getByLabel("Title", { exact: true })
    .fill("Split the release");
  await closedDetail
    .getByRole("button", { name: "Preview Follow-up Work" })
    .click();
  const followUpPreview = closedDetail.getByRole("region", {
    name: "Follow-up Work preview",
  });
  await expect(followUpPreview).toContainText("Split the release");
  await expect(followUpPreview).toContainText("Try next");
  await expect(followUpPreview).toContainText("Ship smaller");
  await expect(followUpPreview).toContainText("Ship the release");
  await followUpPreview.getByRole("button", { name: "Confirm" }).click();
  await expect(closedDetail).toContainText("Split the release");
  const decisions = page.getByRole("region", {
    name: "Still-open Work decisions",
  });
  await expect(decisions).toContainText("Prepare Focus Period release");
  await decisions
    .getByRole("checkbox", { name: FOCUS_PERIOD_WORK_NAME })
    .check();
  await decisions.getByLabel("Destination").selectOption("Backlog");
  await decisions.getByRole("button", { name: "Send" }).click();
  await expect(
    decisions.getByRole("checkbox", { name: FOCUS_PERIOD_WORK_NAME }),
  ).toHaveCount(0);
  await expect(decisions).toContainText("Retire Focus Period draft");
  await decisions.getByRole("checkbox", { name: ABANDON_WORK_NAME }).check();
  await decisions.getByLabel("Destination").selectOption("Abandon");
  await decisions
    .getByRole("checkbox", { name: "Confirm Abandon selected Work" })
    .check();
  await decisions
    .getByRole("checkbox", { name: "Close anyway if closure checks remain" })
    .check();
  await decisions.getByRole("button", { name: "Send" }).click();
  await expect(decisions).toHaveCount(0, { timeout: 30_000 });
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Still-open Work decisions" }),
  ).toHaveCount(0);
});
