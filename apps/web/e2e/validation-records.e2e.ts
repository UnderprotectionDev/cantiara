import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
test("Validation Records preserves context life, persistence, cancelled drafts and retry", async ({
  context,
  page,
  request,
}) => {
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=documents`,
  );
  expect(response.ok()).toBe(true);
  const setup = await response.json();
  await context.addCookies([setup.cookie]);
  await page.goto(`/projects/${setup.projectId}#project-area-discovery`);
  const assumptions = page.getByRole("region", {
    name: "Assumption",
    exact: true,
  });
  await assumptions
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await assumptions.getByLabel("Title", { exact: true }).fill("Export demand");
  await assumptions
    .getByLabel("Statement", { exact: true })
    .fill("Founders need CSV");
  await assumptions.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    assumptions.getByText("Assumption saved.", { exact: true }),
  ).toBeVisible();
  const validations = page.getByRole("region", {
    name: "Validation Record",
    exact: true,
  });
  await validations
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await validations
    .getByLabel("Title", { exact: true })
    .fill("Export interviews");
  await validations
    .getByLabel("Method", { exact: true })
    .fill("Interview five founders");
  await validations
    .getByLabel("Result (optional)", { exact: true })
    .fill("Four need CSV");
  await validations
    .getByRole("checkbox", { name: "Assumption: Export demand", exact: true })
    .check();
  await page.route(
    "**/rpc/createProjectSourceRecord",
    (route) => route.fulfill({ status: 503, body: "Temporarily unavailable" }),
    { times: 1 },
  );
  await validations.getByRole("button", { name: "Save", exact: true }).click();
  await expect(validations.getByRole("alert")).toContainText(
    "could not be saved",
  );
  await expect(validations.getByLabel("Method", { exact: true })).toHaveValue(
    "Interview five founders",
  );
  await validations.getByRole("button", { name: "Retry", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(validations.getByRole("status")).toHaveText(
    "Validation Record saved.",
  );
  await page.reload();
  await expect(validations).toContainText("Four need CSV");
  await validations.getByRole("button", { name: "Edit", exact: true }).click();
  await validations
    .getByLabel("Result (optional)", { exact: true })
    .fill("Cancelled result");
  await validations
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(validations).toContainText("Four need CSV");
  await expect(validations).not.toContainText("Cancelled result");
  const audit = await new AxeBuilder({ page })
    .include('[aria-label="Validation Record"]')
    .analyze();
  expect(audit.violations).toEqual([]);
  await validations
    .getByRole("link", { name: "Assumption: Export demand", exact: true })
    .click();
  await expect(
    assumptions.getByRole("article", { name: "Assumption", exact: true }),
  ).toContainText("Open");
  await page.goto(`/projects/${setup.projectId}#project-area-discovery`);
  await validations
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await validations
    .getByLabel("Status", { exact: true })
    .selectOption("Archived");
  await expect(validations).toContainText("Export interviews");
  await validations
    .getByRole("button", { name: "Restore", exact: true })
    .click();
  await validations
    .getByLabel("Status", { exact: true })
    .selectOption("Active");
  await validations
    .getByRole("button", { name: "Move to Trash", exact: true })
    .click();
  await validations.getByLabel("Status", { exact: true }).selectOption("Trash");
  await page.reload();
  await validations.getByLabel("Status", { exact: true }).selectOption("Trash");
  await expect(validations).toContainText("Export interviews");
  await validations
    .getByRole("button", { name: "Restore", exact: true })
    .click();
  await validations
    .getByLabel("Status", { exact: true })
    .selectOption("Active");
  await expect(validations).toContainText("Interview five founders");
});
