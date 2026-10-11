import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.setTimeout(120_000);
const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
test("Source Check compares and approves a dated candidate without replacing the historical baseline", async ({
  context,
  page,
  request,
}) => {
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=documents`,
  );
  expect(response.ok()).toBe(true);
  const setup = await response.json();
  await context.addCookies([setup.cookie]);
  await page.goto(`/projects/${setup.projectId}#project-area-discovery`);
  const preview = page.getByRole("region", {
    name: "Smart link preview",
    exact: true,
  });
  await preview
    .getByLabel("Source URL")
    .fill("https://example.org/recheck-journey");
  await preview.getByRole("button", { name: "Preview", exact: true }).click();
  await preview
    .getByRole("button", { name: "Save as Source", exact: true })
    .click();
  await expect(preview).toContainText("Source saved.");
  const article = page.locator("#sources article");
  await article
    .getByRole("button", { name: "Source Check", exact: true })
    .click();
  await expect(article).toContainText("third-party server");
  await article
    .getByRole("button", { name: "Recheck source", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  const candidate = article.getByRole("group", {
    name: "Candidate snapshot",
    exact: true,
  });
  await expect(candidate).toContainText("Revised research finding.");
  await expect(
    article.getByRole("group", { name: "Historical snapshot", exact: true }),
  ).toContainText("Original research finding.");
  await article
    .getByRole("group", { name: "Source Check", exact: true })
    .screenshot({ path: "../../.context/source-recheck-comparison.png" });
  await article
    .getByRole("button", { name: "Save as new Source version", exact: true })
    .click();
  await expect(article).toContainText("Save as new Source version · Version 2");
  await page.reload();
  await expect(article).toContainText("Revised research finding.");
  await article
    .getByRole("button", { name: "Source Check", exact: true })
    .click();
  await expect(
    article.getByRole("group", { name: "Historical snapshot", exact: true }),
  ).toContainText("Original research finding.");
  await article
    .getByRole("button", { name: "Recheck source", exact: true })
    .click();
  await article
    .getByRole("button", { name: "Keep current version", exact: true })
    .click();
  await expect(article).toContainText("Keep current version");
  const audit = await new AxeBuilder({ page }).include("#sources").analyze();
  expect(audit.violations).toEqual([]);
});
