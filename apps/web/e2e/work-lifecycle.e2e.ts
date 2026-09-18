import { expect, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const PROJECTS_URL_PATTERN = /\/projects$/;
const PROJECT_DETAIL_URL_PATTERN = /\/projects\/[^/]+$/;
const TYPE_FIELD_PATTERN = /Type:/;

test.setTimeout(60_000);

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

  await firstWork
    .getByRole("combobox", { name: "Type for PAY-1" })
    .selectOption("Bug");
  await expect(firstWork).toContainText("Bug");
  await firstWork
    .getByRole("combobox", { name: "Type for PAY-1" })
    .selectOption("Feature");
  await expect(firstWork.getByLabel("Impact preview")).toBeVisible();
  await firstWork.getByRole("button", { name: "Confirm type change" }).click();
  await expect(firstWork).toContainText("Feature");

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
  await page.getByRole("link", { name: "Create Project" }).click();
  await page.getByLabel("Project Name").fill("Orders");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page.getByRole("link", { name: "Payment App", exact: true }).click();

  const sourceWork = page.getByRole("listitem").filter({
    hasText: "PAY-1 Investigate payment failures",
  });
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

  await page.goto("/projects");
  await page.getByRole("link", { name: "Orders", exact: true }).click();
  const recreatedWork = page.getByRole("listitem").filter({
    hasText: "ORD-1 Investigate payment failures",
  });
  await expect(recreatedWork).toContainText("Task");
  await expect(recreatedWork).toContainText("Not Started");
  await expect(recreatedWork).toContainText("Derived from PAY-1");
});
