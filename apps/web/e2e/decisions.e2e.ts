import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
test("Decisions persists creation and explicit withdrawal, keeps rationale, and preserves cancelled or failed drafts", async ({
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
  await page
    .getByRole("region", { name: "Decisions", exact: true })
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Release scope");
  await page
    .getByLabel("Decision text", { exact: true })
    .fill("Ship the focused release.");
  await page
    .getByLabel("Rationale (optional)", { exact: true })
    .fill("Keep the initial scope inspectable.");
  await page.getByRole("button", { name: "Save", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Decision saved.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Release scope", exact: true }).click();
  const detail = page.getByRole("article", { name: "Decision", exact: true });
  await expect(detail).toContainText("Valid");
  await page.reload();
  await expect(detail).toContainText("Ship the focused release.");
  await page.getByRole("button", { name: "Withdraw", exact: true }).click();
  await page
    .getByLabel("Rationale (optional)", { exact: true })
    .fill("Cancelled withdrawal.");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(detail).toContainText("Valid");
  await page.getByRole("button", { name: "Withdraw", exact: true }).click();
  await page
    .getByLabel("Rationale (optional)", { exact: true })
    .fill("The release constraint no longer applies.");
  await page.route(
    "**/rpc/transitionProjectSourceRecord",
    (route) => route.fulfill({ status: 503, body: "Temporarily unavailable" }),
    { times: 1 },
  );
  await page
    .locator("form")
    .getByRole("button", { name: "Withdraw", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Decision could not be saved" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Rationale (optional)", { exact: true }),
  ).toHaveValue("The release constraint no longer applies.");
  await page
    .locator("form")
    .getByRole("button", { name: "Withdraw", exact: true })
    .click();
  await expect(
    page.getByText("Decision withdrawn.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(detail).toContainText("Withdrawn");
  await expect(detail).toContainText("Keep the initial scope inspectable.");
  await expect(detail).toContainText(
    "The release constraint no longer applies.",
  );
  await expect(detail.locator("time")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Withdraw", exact: true }),
  ).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .include('section[aria-label="Decisions"]')
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
