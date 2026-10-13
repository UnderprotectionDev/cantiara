import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const pasteIdempotencyKeyPattern = /"clientIdempotencyKey":"([^"]+)"/;

test("Table lists, sorts, filters, edits, and atomically applies mapped rows", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const setupResponse = await request.get(
    `${serverUrl}/__e2e/setup?fixture=documents`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = await setupResponse.json();
  await context.addCookies([setup.cookie]);
  await page.goto(`/projects/${setup.projectId}`);
  await page.getByRole("button", { name: "Search", exact: true }).click();

  const discovery = page.getByRole("dialog", { name: "Search", exact: true });
  await discovery
    .getByLabel("Discovery view", { exact: true })
    .selectOption("Table");
  const table = discovery.getByRole("region", { name: "Table", exact: true });
  const grid = table.getByRole("table");
  await expect(grid.getByRole("row")).toHaveCount(2);
  await expect(
    table.getByLabel("Edit Title for Live Work source", { exact: true }),
  ).toHaveValue("Live Work source");

  await table.getByText("Paste rows", { exact: true }).first().click();
  await table
    .getByLabel("Paste rows", { exact: true })
    .fill(
      "Title\tDescription\nZebra launch\tZebra details\nAlpha launch\tAlpha details",
    );
  await table
    .getByRole("button", { name: "Preview paste", exact: true })
    .click();
  await expect(
    table.getByLabel("Map column Title", { exact: true }),
  ).toHaveValue("title");
  await expect(
    table.getByLabel("Map column Description", { exact: true }),
  ).toHaveValue("description");
  await expect(
    table.getByText("Row 1 · Create", { exact: true }),
  ).toBeVisible();
  await expect(
    table.getByText("Row 2 · Create", { exact: true }),
  ).toBeVisible();

  const applyKeys: string[] = [];
  let loseFirstApplyResponse = true;
  await page.route("**/rpc/applyTablePaste", async (route) => {
    const requestBody = JSON.stringify(route.request().postDataJSON());
    const key = requestBody.match(pasteIdempotencyKeyPattern)?.[1];
    if (!key) {
      throw new Error(
        "The Table paste request did not include its idempotency key.",
      );
    }
    applyKeys.push(key);

    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    if (loseFirstApplyResponse) {
      loseFirstApplyResponse = false;
      await route.fulfill({
        body: "Simulated lost response after the server committed the paste.",
        contentType: "text/plain",
        status: 503,
      });
      return;
    }
    await route.fulfill({ response });
  });

  await table
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await expect(table.getByRole("alert")).toBeVisible();

  const applied = page.waitForResponse(
    (response) =>
      response.url().endsWith("/rpc/applyTablePaste") && response.ok(),
  );
  await table
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  expect((await applied).ok()).toBe(true);
  await expect(
    table.getByRole("status").filter({ hasText: "Changes applied." }),
  ).toBeVisible();
  expect(applyKeys).toHaveLength(2);
  expect(applyKeys[1]).toBe(applyKeys[0]);
  await expect(grid.getByRole("row")).toHaveCount(4);

  await table
    .getByLabel("Paste rows", { exact: true })
    .fill(
      "Title\tPlanned start date\nCorrected launch\tnot-a-date\nExcluded launch\t2026-02-03",
    );
  await table
    .getByRole("button", { name: "Preview paste", exact: true })
    .click();
  const correctionRow = table
    .locator("li")
    .filter({ hasText: "Row 1 · Create" });
  await expect(correctionRow.getByRole("alert")).toBeVisible();
  await expect(
    table.getByRole("button", { name: "Apply changes", exact: true }),
  ).toBeDisabled();
  await correctionRow
    .getByLabel("Correct Planned start date in row 1", { exact: true })
    .fill("2026-02-02");
  await correctionRow
    .getByRole("button", { name: "Correct row", exact: true })
    .click();
  const excludedRow = table.locator("li").filter({ hasText: "Row 2 · Create" });
  await excludedRow
    .getByRole("button", { name: "Exclude row", exact: true })
    .click();

  const correctedPaste = page.waitForResponse(
    (response) =>
      response.url().endsWith("/rpc/applyTablePaste") && response.ok(),
  );
  await table
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  expect((await correctedPaste).ok()).toBe(true);
  await expect(
    table.getByRole("status").filter({ hasText: "Changes applied." }),
  ).toBeVisible();
  await expect(grid.getByRole("row")).toHaveCount(5);
  await expect(grid.getByText("Excluded launch", { exact: true })).toHaveCount(
    0,
  );

  await table
    .getByRole("button", { name: "Sort by Title", exact: true })
    .click();
  const sortedTitles = await grid
    .locator("tbody tr input[aria-label^='Edit Title for']")
    .evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLInputElement).value),
    );
  expect(sortedTitles).toEqual([
    "Alpha launch",
    "Corrected launch",
    "Live Work source",
    "Zebra launch",
  ]);

  await table.getByLabel("Filter rows", { exact: true }).fill("Alpha launch");
  await expect(grid.getByRole("row")).toHaveCount(2);
  const alphaTitle = table.getByLabel("Edit Title for Alpha launch", {
    exact: true,
  });
  const refreshedRecords = page.waitForResponse((response) =>
    response.url().endsWith("/rpc/tableRecords"),
  );
  const updated = page.waitForResponse((response) =>
    response.url().endsWith("/rpc/updateTableCell"),
  );
  await alphaTitle.fill("Alpha launch corrected");
  await alphaTitle.press("Tab");
  const updateResponse = await updated;
  expect(updateResponse.ok()).toBe(true);
  expect(await updateResponse.text()).toContain("Alpha launch corrected");
  const refreshedResponse = await refreshedRecords;
  expect(refreshedResponse.ok()).toBe(true);
  expect(await refreshedResponse.text()).toContain("Alpha launch corrected");
  await expect(
    table.getByLabel("Edit Title for Alpha launch corrected", { exact: true }),
  ).toBeVisible();

  const reread = page.waitForResponse((response) =>
    response.url().endsWith("/rpc/tableRecords"),
  );
  await page.reload();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const refreshedDiscovery = page.getByRole("dialog", {
    name: "Search",
    exact: true,
  });
  await refreshedDiscovery
    .getByLabel("Discovery view", { exact: true })
    .selectOption("Table");
  expect((await reread).ok()).toBe(true);
  await expect(
    refreshedDiscovery.getByLabel("Edit Title for Alpha launch corrected", {
      exact: true,
    }),
  ).toBeVisible();
});
