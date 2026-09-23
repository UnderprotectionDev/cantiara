import { expect, type Page, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const CLOSED_SESSION_DATE = /Closed .+/;
const FIRST_WORK_LABEL = /First session Work/;
const MOVE_UP_BUTTON_NAME = /^Move .* up$/;
const QUARTERLY_REVIEW_NAME = /Quarterly review/;
const REMOVE_FROM_SESSION_BUTTON_NAME = /^Remove .* from session$/;

test("keeps Prioritization Session order separate from Backlog and preserves closed scope", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=project-shell`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([{ ...setup.cookie, expires: -1 }]);

  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Prioritization Acceptance");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Prioritization Acceptance", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();

  await createWork(page, "First session Work");
  await createWork(page, "Second session Work");

  await page.getByLabel("Session name").fill("Quarterly review");
  await page.getByRole("checkbox", { name: FIRST_WORK_LABEL }).check();
  await page
    .getByRole("button", { name: "Create Prioritization Session" })
    .click();
  const session = page.getByRole("article", { name: "Quarterly review" });
  await expect(session).toBeVisible();

  const secondWorkOption = session
    .getByLabel("Work to add")
    .locator("option")
    .filter({ hasText: "Second session Work" });
  const secondWorkId = await secondWorkOption.getAttribute("value");
  expect(secondWorkId).toBeTruthy();
  await session.getByLabel("Work to add").selectOption(secondWorkId ?? "");
  await session.getByRole("button", { name: "Add Work" }).click();
  const secondWork = session
    .getByRole("listitem")
    .filter({ hasText: "Second session Work" });
  await secondWork.getByRole("button", { name: MOVE_UP_BUTTON_NAME }).click();
  await expect(secondWork.locator("dd").nth(0)).toHaveText("1");
  await expect(secondWork.locator("dd").nth(1)).toHaveText("2");

  const backlog = page.getByRole("region", { name: "Manual order" });
  const secondBacklogWork = backlog
    .getByRole("listitem")
    .filter({ hasText: "Second session Work" });
  await secondBacklogWork
    .getByRole("button", { name: "Move up", exact: true })
    .click();
  await expect(secondWork.locator("dd").nth(0)).toHaveText("1");
  await expect(secondWork.locator("dd").nth(1)).toHaveText("1");
  const firstBacklogWork = backlog
    .getByRole("listitem")
    .filter({ hasText: "First session Work" });
  await firstBacklogWork
    .getByRole("button", { name: "Move up", exact: true })
    .click();
  await expect(secondWork.locator("dd").nth(0)).toHaveText("1");
  await expect(secondWork.locator("dd").nth(1)).toHaveText("2");

  await session
    .getByRole("listitem")
    .filter({ hasText: "First session Work" })
    .getByRole("button", { name: REMOVE_FROM_SESSION_BUTTON_NAME })
    .click();
  await expect(session.getByRole("listitem")).toHaveCount(1);
  await expect(session.getByText("Second session Work")).toBeVisible();

  await page.reload();
  const persistedSession = page.getByRole("article", {
    name: "Quarterly review",
  });
  await expect(persistedSession.getByRole("listitem")).toHaveCount(1);
  const persistedWork = persistedSession
    .getByRole("listitem")
    .filter({ hasText: "Second session Work" });
  await expect(persistedWork.locator("dd").nth(0)).toHaveText("1");
  await expect(persistedWork.locator("dd").nth(1)).toHaveText("2");

  const firstWorkOption = persistedSession
    .getByLabel("Work to add")
    .locator("option")
    .filter({ hasText: "First session Work" });
  const firstWorkId = await firstWorkOption.getAttribute("value");
  expect(firstWorkId).toBeTruthy();
  await persistedSession
    .getByLabel("Work to add")
    .selectOption(firstWorkId ?? "");
  await persistedSession.getByRole("button", { name: "Add Work" }).click();
  await expect(persistedSession.getByRole("listitem")).toHaveCount(2);

  await persistedSession.getByRole("button", { name: "Close session" }).click();
  await expect(persistedSession.getByText(CLOSED_SESSION_DATE)).toBeVisible();

  await page.reload();
  const closedSession = page.getByRole("article", {
    name: "Quarterly review",
  });
  await expect(closedSession.getByText(CLOSED_SESSION_DATE)).toBeVisible();
  await expect(closedSession.getByRole("listitem")).toHaveCount(2);
  const closedSecondWork = closedSession
    .getByRole("listitem")
    .filter({ hasText: "Second session Work" });
  const closedFirstWork = closedSession
    .getByRole("listitem")
    .filter({ hasText: "First session Work" });
  await expect(closedSecondWork.locator("dd").nth(0)).toHaveText("1");
  await expect(closedSecondWork.locator("dd").nth(1)).toHaveText("2");
  await expect(closedFirstWork.locator("dd").nth(0)).toHaveText("2");
  await expect(closedFirstWork.locator("dd").nth(1)).toHaveText("1");
  await expect(
    closedSession.getByRole("button", { name: MOVE_UP_BUTTON_NAME }),
  ).toHaveCount(0);

  await closedSession.getByRole("button", { name: "Trash" }).click();
  const trash = page.getByRole("region", { name: "Trash" });
  await expect(trash.getByText(QUARTERLY_REVIEW_NAME)).toBeVisible();
  await trash.getByRole("button", { name: "Restore" }).click();
  await expect(
    page.getByRole("article", { name: "Quarterly review" }),
  ).toBeVisible();
});

async function createWork(page: Page, title: string) {
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Title").fill(title);
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(
    page.locator("#work").getByText(title, { exact: true }).first(),
  ).toBeVisible();
}
