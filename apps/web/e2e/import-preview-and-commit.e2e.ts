import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

test("previews a CSV import write-free and commits the exact file once", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=data-import`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
    projectId: string;
  };
  await context.addCookies([setup.cookie]);

  await page.goto("/import");
  await expect(
    page.getByRole("heading", { name: "Import", exact: true }),
  ).toBeVisible();

  await page.locator("#import-file").setInputFiles({
    buffer: Buffer.from("Title,Description\nWrite the brief,Brief the goal\n"),
    mimeType: "text/csv",
    name: "tasks.csv",
  });
  await page
    .getByLabel("Import into")
    .selectOption(`project:${setup.projectId}`);
  await page.getByLabel("Record type (CSV and JSON)").selectOption("Task");
  await page.getByRole("button", { name: "Preview import" }).click();

  await expect(
    page.getByRole("heading", { name: "Preview: tasks.csv" }),
  ).toBeVisible();
  await expect(
    page.getByText("Nothing has been written to your records."),
  ).toBeVisible();
  await expect(page.getByText("Write the brief")).toBeVisible();

  // The closed a11y journey "import önizleme ve commit" lands on the preview.
  const accessibilityScan = await new AxeBuilder({ page })
    .include("main")
    .analyze();
  expect(accessibilityScan.violations).toEqual([]);

  await page.getByRole("button", { name: "Apply Import" }).click();

  await expect(
    page.getByRole("heading", { name: "Import receipt" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Committed. tasks.csv was written to Import Acceptance once.",
    ),
  ).toBeVisible();

  // The durable receipt reopens by its idempotency key after the fact.
  await page
    .locator('section[aria-label="Import receipt reopen"]')
    .getByRole("button", { name: "Reopen receipt" })
    .click();
  await expect(
    page.getByText("This is the same receipt, reopened."),
  ).toBeVisible();
});
