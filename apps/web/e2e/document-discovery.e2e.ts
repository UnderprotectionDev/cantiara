import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const wikiSourceUrlPattern = /\/personal-wiki#document-/;
const projectSourceUrlPattern = /\/projects\/[^#]+#document-/;

test("Search and All Documents keep mixed Wiki and Project hits in their original homes", async ({
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
  async function createDocument() {
    await page
      .getByRole("button", { name: "Create Document", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Create Document" });
    await dialog
      .getByLabel("Title", { exact: true })
      .fill("Connection recovery");
    await dialog
      .getByRole("button", { name: "Create Document", exact: true })
      .click();
    const editor = page.getByRole("region", { name: "Document", exact: true });
    await editor.getByRole("tab", { name: "Markdown", exact: true }).click();
    await editor
      .getByRole("textbox", { name: "Markdown source", exact: true })
      .fill("# PostgreSQL troubleshooting\n\nReconnect safely.");
    const saved = page.waitForResponse((result) =>
      result.url().endsWith("/rpc/updateDocument"),
    );
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    expect((await saved).ok()).toBe(true);
  }
  await page.goto(`/projects/${setup.projectId}#documents`);
  await createDocument();
  await page.getByRole("link", { name: "Personal Wiki", exact: true }).click();
  await createDocument();
  await page.reload();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const discovery = page.getByRole("dialog", { name: "Search", exact: true });
  await expect(discovery).toContainText("Type to search authorized records.");
  const searched = page.waitForResponse((result) =>
    result.url().endsWith("/rpc/searchRecords"),
  );
  await discovery
    .getByRole("textbox", { name: "Search", exact: true })
    .fill("PostgreSQL");
  expect((await searched).ok()).toBe(true);
  const searchResults = discovery.getByRole("list", {
    name: "Search results",
    exact: true,
  });
  await expect(searchResults.getByRole("listitem")).toHaveCount(2);
  await expect(searchResults).toContainText("Personal Wiki");
  await expect(searchResults).toContainText("Project:");
  await expect(searchResults.locator("mark")).toHaveCount(2);
  await searchResults
    .getByRole("listitem")
    .filter({ hasText: "Personal Wiki" })
    .getByRole("link", { name: "Open Connection recovery", exact: true })
    .click();
  await expect(page).toHaveURL(wikiSourceUrlPattern);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    discovery.getByRole("textbox", { name: "Search", exact: true }),
  ).toHaveValue("");
  await discovery
    .getByLabel("Discovery view", { exact: true })
    .selectOption("All Documents");
  const results = discovery.getByRole("list", {
    name: "All Documents",
    exact: true,
  });
  await expect(results.getByRole("listitem")).toHaveCount(2);
  await discovery.getByLabel("Scope", { exact: true }).selectOption("wiki");
  await expect(results.getByRole("listitem")).toHaveCount(1);
  await expect(results).not.toContainText("Project:");
  await discovery
    .getByLabel("Scope", { exact: true })
    .selectOption(`project:${setup.projectId}`);
  await expect(results.getByRole("listitem")).toHaveCount(1);
  await expect(results).not.toContainText("Personal Wiki");
  await discovery
    .getByLabel("Discovery view", { exact: true })
    .selectOption("All Documents");
  await discovery.getByLabel("Scope", { exact: true }).selectOption("all");
  await expect(results.getByRole("listitem")).toHaveCount(2);
  await expect(results).toContainText("Personal Wiki");
  await expect(results).toContainText("Project:");
  await page.screenshot({
    path: "../../.context/wiki-discovery.png",
    fullPage: true,
  });
  await discovery.getByLabel("Scope", { exact: true }).selectOption("wiki");
  await results
    .getByRole("link", { name: "Open source record", exact: true })
    .click();
  await expect(page).toHaveURL(wikiSourceUrlPattern);
  await expect(
    page
      .getByRole("region", { name: "Document", exact: true })
      .getByLabel("Title", { exact: true }),
  ).toHaveValue("Connection recovery");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    discovery.getByLabel("Discovery view", { exact: true }),
  ).toHaveValue("Search");
  await expect(
    discovery.getByRole("textbox", { name: "Search", exact: true }),
  ).toHaveValue("");
  await discovery
    .getByLabel("Discovery view", { exact: true })
    .selectOption("All Documents");
  await expect(discovery.getByLabel("Scope", { exact: true })).toHaveValue(
    "all",
  );
  await expect(results.getByRole("listitem")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(discovery).toBeHidden();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await discovery
    .getByLabel("Discovery view", { exact: true })
    .selectOption("All Documents");
  await discovery
    .getByLabel("Scope", { exact: true })
    .selectOption(`project:${setup.projectId}`);
  await results
    .getByRole("link", { name: "Open source record", exact: true })
    .click();
  await expect(page).toHaveURL(projectSourceUrlPattern);
  await expect(
    page
      .getByRole("region", { name: "Document", exact: true })
      .getByLabel("Title", { exact: true }),
  ).toHaveValue("Connection recovery");
});
