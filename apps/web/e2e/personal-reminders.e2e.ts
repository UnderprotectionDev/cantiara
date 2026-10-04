import { expect, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

test("persists and cancels a Project reminder", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(90_000);

  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=personal-reminders`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([setup.cookie]);

  const projectName = "Personal Reminders Persistence";
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill(projectName);
  await page.getByRole("button", { name: "Create Project" }).click();
  const projectLink = page.getByRole("link", {
    exact: true,
    name: projectName,
  });
  await expect(projectLink).toBeVisible({ timeout: 30_000 });
  await projectLink.click();

  const overview = page.locator("#overview");
  const openReminder = overview.getByRole("button", {
    name: "Remind me",
    exact: true,
  });
  await openReminder.click();

  const dialog = page.getByRole("dialog", { name: "Remind me" });
  const history = dialog.getByRole("region", { name: "Reminder history" });
  await expect(
    history.getByText("No reminders.", { exact: true }),
  ).toBeVisible();

  const fireAt = await page.evaluate(() => {
    const date = new Date(Date.now() + 60 * 60 * 1000);
    date.setSeconds(0, 0);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
      .toISOString()
      .slice(0, 16);
  });
  await dialog.getByLabel("When").fill(fireAt);

  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/rpc/createPersonalReminder"),
  );
  await dialog.getByRole("button", { name: "Set reminder" }).click();
  expect((await createResponse).ok()).toBe(true);

  const plannedReminder = history
    .getByRole("listitem")
    .filter({ hasText: "Remind me" });
  await expect(plannedReminder).toContainText("Planned");

  await page.reload();
  await page
    .locator("#overview")
    .getByRole("button", { name: "Remind me" })
    .click();
  const reloadedDialog = page.getByRole("dialog", { name: "Remind me" });
  const reloadedHistory = reloadedDialog.getByRole("region", {
    name: "Reminder history",
  });
  const persistedReminder = reloadedHistory
    .getByRole("listitem")
    .filter({ hasText: "Remind me" });
  await expect(persistedReminder).toContainText("Planned");

  const cancelResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/rpc/cancelPersonalReminder"),
  );
  await persistedReminder.getByRole("button", { name: "Cancel" }).click();
  expect((await cancelResponse).ok()).toBe(true);
  await expect(persistedReminder).toContainText("Cancelled");

  await page.reload();
  await page
    .locator("#overview")
    .getByRole("button", { name: "Remind me" })
    .click();
  await expect(
    page
      .getByRole("dialog", { name: "Remind me" })
      .getByRole("region", { name: "Reminder history" })
      .getByRole("listitem")
      .filter({ hasText: "Remind me" }),
  ).toContainText("Cancelled");
});
