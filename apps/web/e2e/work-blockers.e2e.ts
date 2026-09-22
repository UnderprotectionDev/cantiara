import { expect, type Page, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const STATUS_FOR_PATTERN = /Status for/;

function workListItem(page: Page, title: string) {
  return page.getByRole("listitem").filter({
    has: page.locator("p").filter({ hasText: title }),
  });
}

async function createWork(page: Page, title: string) {
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Title").fill(title);
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  const work = workListItem(page, title);
  await expect(work).toBeVisible();
  return work;
}

test("creates and removes an Active blocker without changing Work status", async ({
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
  await page.getByLabel("Project Name").fill("Work Blockers Project");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Work Blockers Project", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();

  const blocker = await createWork(page, "Wait for provider access");
  const blockedWork = await createWork(page, "Prepare payment confirmation");
  const createKeys: string[] = [];
  let dropFirstCreateResponse = true;
  await page.route("**/rpc/createRelation", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const requestBody = route.request().postDataJSON() as {
      json?: { clientIdempotencyKey?: string };
    };
    const idempotencyKey = requestBody.json?.clientIdempotencyKey;
    if (idempotencyKey) {
      createKeys.push(idempotencyKey);
    }
    if (dropFirstCreateResponse) {
      dropFirstCreateResponse = false;
      await route.fetch();
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await blockedWork
    .locator("summary")
    .filter({ hasText: "Create Persistent Relation" })
    .click();
  await blockedWork.getByLabel("Relation type").selectOption("Blocked by");
  const blockerOption = blockedWork
    .getByLabel("Related Work")
    .locator("option")
    .filter({ hasText: "Wait for provider access" });
  const blockerId = await blockerOption.getAttribute("value");
  if (!blockerId) {
    throw new Error("The blocker Work was not available for selection.");
  }
  await blockedWork.getByLabel("Related Work").selectOption(blockerId);
  await blockedWork.getByRole("button", { name: "Preview relation" }).click();
  const preview = blockedWork.getByRole("status", {
    name: "Relation preview",
  });
  await expect(preview).toContainText("Active");
  await preview.getByRole("button", { name: "Confirm relation" }).click();
  await expect(blockedWork.getByRole("alert")).toBeVisible();
  await preview.getByRole("button", { name: "Confirm relation" }).click();

  expect(createKeys).toHaveLength(2);
  expect(createKeys[0]).toBe(createKeys[1]);
  await expect(blockedWork).toContainText("Blocked by");
  await expect(blockedWork.getByText("Active", { exact: true })).toBeVisible();
  await expect(blocker).toContainText("Blocks");
  await expect(blocker.getByText("Active", { exact: true })).toBeVisible();
  await expect(
    blockedWork.getByRole("button", { name: "Remove relation" }),
  ).toHaveCount(1);
  await expect(
    blocker.getByRole("combobox", { name: STATUS_FOR_PATTERN }),
  ).toHaveValue("Not Started");
  await expect(
    blockedWork.getByRole("combobox", { name: STATUS_FOR_PATTERN }),
  ).toHaveValue("Not Started");

  await blockedWork.getByRole("button", { name: "Remove relation" }).click();
  await expect(blockedWork.getByText("Relation removed.")).toBeVisible();
  await expect(blockedWork).not.toContainText("Active");
  await expect(
    blocker.getByRole("combobox", { name: STATUS_FOR_PATTERN }),
  ).toHaveValue("Not Started");
  await expect(
    blockedWork.getByRole("combobox", { name: STATUS_FOR_PATTERN }),
  ).toHaveValue("Not Started");
});
