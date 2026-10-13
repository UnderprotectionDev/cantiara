import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

const FORBIDDEN_SUMMARY = /health|progress|success|\d+%/i;
const WORK_URL = /#work-/;
test("Project Goal membership persists without writing Work state or producing health", async ({
  context,
  page,
  request,
}) => {
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=scope-tree`,
  );
  expect(response.ok()).toBe(true);
  const setup = await response.json();
  await context.addCookies([setup.cookie]);
  await page.goto(`/projects/${setup.projectId}#goals`);
  await page.getByRole("button", { name: "New Project Goal" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Useful first release");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Keep discovery and delivery context.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("link", { name: "Useful first release", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Live summary", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Record", { exact: true })
    .selectOption({ label: "Wait for provider access · Research" });
  await page
    .getByRole("button", { name: "Add contribution", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  const summary = page.getByRole("region", {
    name: "Live summary",
    exact: true,
  });
  await expect(summary).toContainText("Research · Not Started: 1");
  await page.reload();
  await expect(summary).toContainText("Research · Not Started: 1");
  await page
    .getByLabel("Record", { exact: true })
    .selectOption({ label: "Checkout Feature · Feature" });
  const selection = await page
    .getByLabel("Record", { exact: true })
    .inputValue();
  await page.route(
    "**/rpc/setProjectGoalRelation",
    (route) => route.fulfill({ status: 503, body: "Unavailable" }),
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Add contribution", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Relation could not be saved" }),
  ).toBeVisible();
  await expect(page.getByLabel("Record", { exact: true })).toHaveValue(
    selection,
  );
  await page
    .getByRole("button", { name: "Add contribution", exact: true })
    .click();
  await expect(summary).toContainText("Feature · Not Started: 1");
  await page.getByLabel("Relation", { exact: true }).selectOption("Related");
  await page
    .getByLabel("Record", { exact: true })
    .selectOption({ label: "Verify provider callback · Task" });
  await page.getByRole("button", { name: "Add relation", exact: true }).click();
  await expect(summary).not.toContainText("Task");
  await expect(summary).not.toContainText(FORBIDDEN_SUMMARY);
  const contributions = page.getByRole("region", {
    name: "Contributes to Goal",
    exact: true,
  });
  await expect(
    contributions.getByRole("link", {
      name: "Wait for provider access",
      exact: true,
    }),
  ).toHaveAttribute("href", WORK_URL);
  expect(
    (
      await new AxeBuilder({ page })
        .include('section[aria-label="Project Goal"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await contributions
    .getByRole("button", { name: "Remove contribution", exact: true })
    .first()
    .click();
  await page.reload();
  await expect(summary).not.toContainText("Research · Not Started: 1");
  await expect(summary).toContainText("Feature · Not Started: 1");
});
