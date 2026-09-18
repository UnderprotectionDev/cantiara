import { expect, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const PROJECTS_URL_PATTERN = /\/projects$/;
const PROJECT_DETAIL_URL_PATTERN = /\/projects\/[^/]+$/;

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

  await page.reload();
  await expect(
    page.getByRole("listitem").filter({
      hasText: "PAY-1 Investigate payment failures",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({
      hasText: "PAY-2 Document the payment flow",
    }),
  ).toContainText("Task");

  await page.goto("/projects");
  const project = page.getByRole("listitem").filter({ hasText: "Payment App" });
  await expect(
    project.getByRole("textbox", { name: "Short code" }),
  ).toBeDisabled();
});
