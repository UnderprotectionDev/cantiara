import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
test("Uncertainty Records persists outcomes and exact evidence and preserves cancelled or failed drafts", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=documents`,
  );
  expect(response.ok()).toBe(true);
  const setup = await response.json();
  await context.addCookies([setup.cookie]);
  await page.goto(`/projects/${setup.projectId}#documents`);
  await page
    .getByRole("button", { name: "Create Document", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Create Document" });
  await dialog.getByLabel("Title", { exact: true }).fill("Customer interview");
  await dialog
    .getByRole("button", { name: "Create Document", exact: true })
    .click();
  const editor = page.getByRole("region", { name: "Document", exact: true });
  await editor.getByRole("tab", { name: "Markdown", exact: true }).click();
  await editor
    .getByRole("textbox", { name: "Markdown source", exact: true })
    .fill("Customers need CSV export.");
  const saved = page.waitForResponse((result) =>
    result.url().endsWith("/rpc/updateDocument"),
  );
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await page.goto(`/projects/${setup.projectId}#project-area-discovery`);
  const assumptions = page.getByRole("region", {
    name: "Assumption",
    exact: true,
  });
  await assumptions
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Export demand");
  await page
    .getByLabel("Statement", { exact: true })
    .fill("Customers will pay for export.");
  await page.getByRole("button", { name: "Save", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Assumption saved.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Export demand", exact: true }).click();
  const detail = page.getByRole("article", { name: "Assumption", exact: true });
  await detail.getByRole("button", { name: "Confirmed", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(detail.getByText("Confirmed", { exact: true })).toBeVisible();
  await expect(detail).toContainText("No evidence linked.");
  await page.reload();
  await expect(detail.getByText("Confirmed", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Refuted", exact: true }).click();
  await page
    .getByLabel("Rationale (optional)", { exact: true })
    .fill("Cancelled result");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(detail.getByText("Confirmed", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Refuted", exact: true }).click();
  await page
    .getByLabel("Rationale (optional)", { exact: true })
    .fill("Customers expect it for free.");
  const evidence = page.getByLabel("Evidence (optional)", { exact: true });
  await expect(
    evidence.locator("option").filter({ hasText: "Customer interview" }),
  ).toHaveCount(1);
  const evidenceId = await evidence
    .locator("option")
    .filter({ hasText: "Customer interview" })
    .getAttribute("value");
  await evidence.selectOption(evidenceId ?? "");
  await page.route(
    "**/rpc/transitionProjectSourceRecord",
    (route) => route.fulfill({ status: 503, body: "Temporarily unavailable" }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Assumption could not be saved" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Rationale (optional)", { exact: true }),
  ).toHaveValue("Customers expect it for free.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(detail.getByText("Refuted", { exact: true })).toBeVisible();
  await page.reload();
  await expect(detail).toContainText("Customers need CSV export.");
  await detail
    .getByRole("button", { name: "No longer applicable", exact: true })
    .click();
  await expect(
    page.getByLabel("Evidence (optional)", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  await expect(
    detail.getByText("No longer applicable", { exact: true }),
  ).toBeVisible();
  await expect(detail).toContainText("Customers need CSV export.");
  await expect(detail).toContainText("Customers expect it for free.");
  await detail.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Export demand revised");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  await expect(detail).toContainText("Export demand revised");
  expect(
    (
      await new AxeBuilder({ page })
        .include('section[aria-label="Assumption"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(detail).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("Assumption outcome keeps the Document version offered when editing starts", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=documents`,
  );
  expect(response.ok()).toBe(true);
  const setup = await response.json();
  await context.addCookies([setup.cookie]);
  const route = `/projects/${setup.projectId}`;
  await page.goto(`${route}#documents`);
  await page
    .getByRole("button", { name: "Create Document", exact: true })
    .click();
  const create = page.getByRole("dialog", { name: "Create Document" });
  await create.getByLabel("Title", { exact: true }).fill("Customer interview");
  await create
    .getByRole("button", { name: "Create Document", exact: true })
    .click();
  const documentEditor = page.getByRole("region", {
    name: "Document",
    exact: true,
  });
  await documentEditor
    .getByRole("tab", { name: "Markdown", exact: true })
    .click();
  await documentEditor
    .getByRole("textbox", { name: "Markdown source", exact: true })
    .fill("Evidence from Document Version 2.");
  const firstSave = page.waitForResponse((result) =>
    result.url().endsWith("/rpc/updateDocument"),
  );
  await documentEditor
    .getByRole("button", { name: "Save", exact: true })
    .click();
  expect((await firstSave).ok()).toBe(true);

  await page.goto(`${route}#project-area-discovery`);
  const assumptions = page.getByRole("region", {
    name: "Assumption",
    exact: true,
  });
  await assumptions
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Export demand");
  await page
    .getByLabel("Statement", { exact: true })
    .fill("Customers will pay for export.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Assumption saved.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Export demand", exact: true }).click();
  const detail = page.getByRole("article", { name: "Assumption", exact: true });
  await detail.getByRole("button", { name: "Refuted", exact: true }).click();
  const evidence = page.getByLabel("Evidence (optional)", { exact: true });
  const documentId = await evidence
    .locator("option")
    .filter({ hasText: "Customer interview — Version 2" })
    .getAttribute("value");
  expect(documentId).toBeTruthy();
  await evidence.selectOption(documentId ?? "");

  const second = await context.newPage();
  await second.goto(`${route}#documents`);
  await second
    .getByRole("button", { name: "Customer interview", exact: true })
    .click();
  const secondEditor = second.getByRole("region", {
    name: "Document",
    exact: true,
  });
  await secondEditor
    .getByRole("tab", { name: "Markdown", exact: true })
    .click();
  await secondEditor
    .getByRole("textbox", { name: "Markdown source", exact: true })
    .fill("Evidence from Document Version 3.");
  const secondSave = second.waitForResponse((result) =>
    result.url().endsWith("/rpc/updateDocument"),
  );
  await secondEditor.getByRole("button", { name: "Save", exact: true }).click();
  expect((await secondSave).ok()).toBe(true);

  const refreshedDocuments = page.waitForResponse((result) =>
    result.url().includes("/rpc/documents"),
  );
  await page.evaluate(async (projectId) => {
    const moduleUrl = new URL("/src/utils/orpc.ts", window.location.origin)
      .href;
    const { orpc, queryClient } = await import(/* @vite-ignore */ moduleUrl);
    await queryClient.invalidateQueries({
      queryKey: orpc.documents.queryOptions({ input: { projectId } }).queryKey,
    });
  }, setup.projectId);
  expect((await refreshedDocuments).ok()).toBe(true);
  await expect(
    evidence
      .locator("option")
      .filter({ hasText: "Customer interview — Version 2" }),
  ).toHaveCount(1);
  await expect(
    evidence
      .locator("option")
      .filter({ hasText: "Customer interview — Version 3" }),
  ).toHaveCount(0);
  await expect(page.locator("pre")).toContainText(
    "Evidence from Document Version 2.",
  );

  const transitionResponse = page.waitForResponse((result) =>
    result.url().includes("transitionProjectSourceRecord"),
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const transitionResult = await transitionResponse;
  expect(transitionResult.status()).toBe(409);
  const transitionBody = await transitionResult.json();
  expect(transitionBody.json.code, JSON.stringify(transitionBody)).toBe(
    "CONFLICT",
  );
  await expect(
    page.getByRole("alert").filter({
      hasText: "Assumption or Evidence changed. Cancel and reopen",
    }),
  ).toBeVisible();
  await expect(detail.getByText("Open", { exact: true })).toBeVisible();
  await expect(evidence).toHaveValue(documentId ?? "");
});
