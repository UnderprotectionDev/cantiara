import { expect, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const PROJECTS_URL_PATTERN = /\/projects$/;
const PROJECT_DETAIL_URL_PATTERN = /\/projects\/[^/]+$/;

test("creates Work with a Project key, type, and protected start status", async ({
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
