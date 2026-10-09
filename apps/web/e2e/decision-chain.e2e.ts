// biome-ignore-all lint/performance/noAwaitInLoops: Browser transitions commit sequential generations.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const originalTitlePattern = /Chain original/;
const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
test("Decisions follows the historical chain to the final Valid record and filters historical search results", async ({
  context,
  page,
  request,
}) => {
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=scope-tree`,
  );
  expect(response.ok()).toBe(true);
  const setup = await response.json();
  await context.addCookies([setup.cookie]);
  await page.goto(`/projects/${setup.projectId}#decisions`);
  const decisions = page.getByRole("region", {
    name: "Decisions",
    exact: true,
  });
  for (const title of [
    "Chain original",
    "Chain revision",
    "Chain current",
    "Chain withdrawn",
  ]) {
    await decisions
      .getByRole("button", { name: "Create", exact: true })
      .click();
    await page.getByLabel("Title", { exact: true }).fill(title);
    await page
      .getByLabel("Decision text", { exact: true })
      .fill(`Choose ${title}`);
    await page
      .getByLabel("Rationale (optional)", { exact: true })
      .fill(`Reason for ${title}`);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByText("Decision saved.", { exact: true }),
    ).toBeVisible();
  }
  const list = decisions.getByRole("list").first();
  await list
    .getByRole("link", { name: "Chain withdrawn", exact: true })
    .click();
  await page.getByRole("button", { name: "Withdraw", exact: true }).click();
  await page.getByRole("button", { name: "Withdraw", exact: true }).click();
  await expect(
    page.getByText("Decision withdrawn.", { exact: true }),
  ).toBeVisible();
  for (const [oldTitle, newTitle] of [
    ["Chain original", "Chain revision"],
    ["Chain revision", "Chain current"],
  ]) {
    await list.getByRole("link", { name: newTitle, exact: true }).click();
    await page
      .getByRole("button", { name: "Supersede another decision", exact: true })
      .click();
    await page.getByRole("checkbox", { name: oldTitle, exact: true }).check();
    await page
      .getByLabel("Transition rationale (optional)")
      .fill(`Replacement for ${oldTitle}`);
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page
      .getByRole("button", { name: "Confirm supersession", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Supersession preview" }),
    ).toHaveCount(0);
  }
  await list.getByRole("link", { name: "Chain original", exact: true }).click();
  const chain = page.getByRole("region", {
    name: "Decision chain",
    exact: true,
  });
  await expect(chain.getByRole("list").getByRole("link")).toHaveText([
    "Chain original",
    "Chain revision",
    "Chain current",
  ]);
  await expect(chain).toContainText("Replacement for Chain original");
  await expect(
    page.getByRole("article", { name: "Decision", exact: true }),
  ).toContainText("Reason for Chain original");
  await expect(
    page.getByRole("button", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  await chain
    .getByRole("link", { name: "Open current decision", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page
      .getByRole("article", { name: "Decision", exact: true })
      .getByRole("heading", { name: "Chain current" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("article", { name: "Decision", exact: true })
      .getByRole("heading", { name: "Chain current" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Search", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Search", exact: true });
  await dialog.getByLabel("Search", { exact: true }).fill("Chain");
  await expect(dialog).toContainText("Chain current");
  await expect(
    dialog.getByRole("link", { name: originalTitlePattern }),
  ).toHaveCount(0);
  await dialog.getByLabel("Status", { exact: true }).selectOption("Superseded");
  await expect(dialog).toContainText("Chain original");
  await expect(dialog).toContainText("Chain revision");
  await dialog.getByLabel("Status", { exact: true }).selectOption("Withdrawn");
  await expect(dialog).toContainText("Chain withdrawn");
  await dialog.getByLabel("Discovery view").selectOption("All Decisions");
  await expect(dialog).toContainText("Chain current");
  await expect(dialog).not.toContainText("Chain original");
  await dialog.getByLabel("Status", { exact: true }).selectOption("Superseded");
  await expect(dialog).toContainText("Chain original");
  await page.keyboard.press("Escape");
  await list.getByRole("link", { name: "Chain original", exact: true }).click();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    (
      await new AxeBuilder({ page })
        .include('section[aria-label="Decisions"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("article", { name: "Decision", exact: true })
    .screenshot({ path: "../../.context/decision-chain.png" });
});
