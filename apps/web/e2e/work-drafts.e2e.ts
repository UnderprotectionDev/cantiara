import { expect, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const PROJECTS_URL_PATTERN = /\/projects$/;
const PROJECT_DETAIL_URL_PATTERN = /\/projects\/[^/]+$/;
const QUEUE_TEXT_PATTERN = /queue/i;

test.setTimeout(90_000);

test("keeps Work Drafts online-only and finalizes one Work", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=work-drafts`,
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
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await page.getByRole("link", { name: "Create", exact: true }).click();

  const workCreate = page.locator("#work-create");
  const title = page.getByLabel("Title");
  await title.fill("Saved payment investigation");
  const savedDraft = page
    .getByRole("list", { name: "Drafts" })
    .getByRole("listitem")
    .filter({ hasText: "Saved payment investigation" });
  await expect(savedDraft).toBeVisible({ timeout: 20_000 });

  await context.setOffline(true);
  await page.waitForFunction(() => navigator.onLine === false);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  const offlineState = page.getByRole("status").filter({
    hasText: "You’re offline",
  });
  await expect(offlineState).toBeVisible();
  await expect(
    workCreate.getByRole("status").filter({ hasText: "You’re offline" }),
  ).toBeVisible();
  await expect(
    page
      .locator("main > [role='status']")
      .filter({ hasText: "You’re offline" }),
  ).toHaveCount(0);
  await expect(workCreate.getByText("Ready", { exact: true })).toHaveCount(0);
  await title.fill("Unsaved offline change");
  await expect(offlineState).toContainText("Last saved");
  await expect(offlineState).toContainText("Unsaved changes may be lost");
  await expect(page.getByText(QUEUE_TEXT_PATTERN)).toHaveCount(0);

  await context.setOffline(false);
  await page.waitForFunction(() => navigator.onLine === true);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(offlineState).toHaveCount(0);
  await page.waitForTimeout(1000);

  await page.reload();
  const resumedDraft = page
    .getByRole("list", { name: "Drafts" })
    .getByRole("listitem")
    .filter({ hasText: "Saved payment investigation" });
  await expect(resumedDraft).toBeVisible({ timeout: 20_000 });
  await resumedDraft.getByRole("button", { name: "Resume" }).click();
  await expect(title).toHaveValue("Saved payment investigation");

  await workCreate.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    page.getByText("Work PAY-1 created.", { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  const workList = page.getByRole("list", { name: "Work list" });
  await expect(workList).toContainText("PAY-1 Saved payment investigation");
  await expect(
    page
      .getByRole("list", { name: "Drafts" })
      .getByText("Saved payment investigation", { exact: true }),
  ).toHaveCount(0);

  await workCreate.getByRole("button", { name: "Create", exact: true }).click();
  await expect(workList).not.toContainText("PAY-2");

  // Drafts are personal to the account: a Draft saved here stays visible and
  // resumable from another Project's Drafts surface, and finalizes into its
  // own Project.
  await title.fill("Cross project handoff");
  await expect(
    page
      .getByRole("list", { name: "Drafts" })
      .getByRole("listitem")
      .filter({ hasText: "Cross project handoff" }),
  ).toBeVisible({ timeout: 20_000 });

  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await expect(page).toHaveURL(PROJECTS_URL_PATTERN);
  await page.getByRole("link", { name: "Ledger App", exact: true }).click();
  await expect(page).toHaveURL(PROJECT_DETAIL_URL_PATTERN);
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await page.getByRole("link", { name: "Create", exact: true }).click();

  const ledgerDrafts = page.getByRole("list", { name: "Drafts" });
  const crossProjectDraft = ledgerDrafts
    .getByRole("listitem")
    .filter({ hasText: "Cross project handoff" });
  await expect(crossProjectDraft).toBeVisible({ timeout: 20_000 });
  await crossProjectDraft.getByRole("button", { name: "Resume" }).click();
  await expect(title).toHaveValue("Cross project handoff");
  await expect(
    workCreate.getByText("Payment App", { exact: true }),
  ).toBeVisible();

  await workCreate.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    page.getByText("Work PAY-2 created.", { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(ledgerDrafts).not.toContainText("Cross project handoff");
});
