import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

test("creates a 1–8 week Focus Period and changes membership without changing Work status", async ({
  context,
  page,
  request,
}) => {
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
  await expect(detail).toContainText("Not Started");
  await page.reload();
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
  await expect(
    page.getByRole("region", { name: "Ship the release" }),
  ).toContainText("Not Started");
});
