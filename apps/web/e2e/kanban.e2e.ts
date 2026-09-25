import { expect, type Page, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const MOVE_BUTTON_NAME = /^Move /;

function boardCard(page: Page, column: string, title: string) {
  return page
    .locator(`[data-kanban-column="${column}"] article`)
    .filter({ hasText: title });
}

async function moveCard(page: Page, from: string, to: string, title: string) {
  await boardCard(page, from, title)
    .getByRole("button", { name: MOVE_BUTTON_NAME })
    .dragTo(page.locator(`[data-kanban-column="${to}"]`));
}

async function openBoard(page: Page) {
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Board" })).toBeVisible();
}

test("moves Work through Board with explicit close and reopen steps", async ({
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
  await page.getByLabel("Project Name").fill("Kanban Acceptance Project");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Kanban Acceptance Project", exact: true })
    .click();
  await openBoard(page);

  const title = "Move through workflow status";
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Title").fill(title);
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await openBoard(page);

  const initialCard = boardCard(page, "Not Started", title);
  await expect(initialCard).toBeVisible();
  const moveLabel = await initialCard
    .getByRole("button", { name: MOVE_BUTTON_NAME })
    .getAttribute("aria-label");
  if (!moveLabel) {
    throw new Error("The Work card does not have a Move control.");
  }
  const workKey = moveLabel.replace("Move ", "");

  await moveCard(page, "Not Started", "In Progress", title);
  await expect(boardCard(page, "In Progress", title)).toBeVisible();
  await page.reload();
  await expect(boardCard(page, "In Progress", title)).toBeVisible();

  await moveCard(page, "In Progress", "Closed", title);
  let closeDialog = page.getByRole("dialog", { name: `Close ${workKey}` });
  await expect(closeDialog).toBeVisible();
  await closeDialog.getByRole("button", { name: "Return to work" }).click();
  await expect(
    page.getByRole("combobox", { name: `Status for ${workKey}` }),
  ).toHaveValue("In Progress");

  await openBoard(page);
  await moveCard(page, "In Progress", "Closed", title);
  closeDialog = page.getByRole("dialog", { name: `Close ${workKey}` });
  await expect(closeDialog).toBeVisible();
  await closeDialog
    .getByLabel(`Closure result for ${workKey}`)
    .selectOption("Abandoned");
  await closeDialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: `Status for ${workKey}` }),
  ).toHaveValue("Closed");

  await openBoard(page);
  const closedCard = boardCard(page, "Closed", title);
  await expect(closedCard).toContainText("Abandoned");
  await moveCard(page, "Closed", "In Progress", title);
  const reopenDialog = page.getByRole("dialog", {
    name: `Reopen ${workKey}`,
  });
  await expect(reopenDialog).toContainText("Reopen as In Progress?");
  await reopenDialog.getByRole("button", { name: "Confirm reopen" }).click();
  await expect(
    page.getByRole("combobox", { name: `Status for ${workKey}` }),
  ).toHaveValue("In Progress");

  await openBoard(page);
  await expect(boardCard(page, "In Progress", title)).toBeVisible();
  await expect(boardCard(page, "Closed", title)).toHaveCount(0);
});
