// biome-ignore-all lint/performance/noAwaitInLoops: Browser creation steps must execute in order.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
test("Decisions previews full supersession, retains failed confirmation, persists and explicitly removes it", async ({
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
  for (const title of ["Original scope", "New scope"]) {
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
  await page.getByRole("link", { name: "New scope", exact: true }).click();
  await page
    .getByRole("button", { name: "Supersede another decision", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Original scope", exact: true })
    .check();
  await page
    .getByLabel("Transition rationale (optional)")
    .fill("Constraints changed");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.getByRole("region", { name: "Supersession preview" });
  await expect(preview).toContainText("Valid → Superseded");
  await expect(preview).toContainText("Reason for Original scope");
  await expect(preview).toContainText("Reason for New scope");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    decisions.getByRole("listitem").filter({ hasText: "Original scope" }),
  ).toContainText("Valid");
  await page
    .getByRole("button", { name: "Supersede another decision", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Original scope", exact: true })
    .check();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page.route(
    "**/rpc/commitDecisionSupersession",
    (route) => route.fulfill({ status: 503, body: "Unavailable" }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Confirm supersession" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Supersession could not be saved" }),
  ).toBeVisible();
  await expect(preview).toBeVisible();
  await page.getByRole("button", { name: "Confirm supersession" }).focus();
  await page.keyboard.press("Enter");
  await expect(preview).toHaveCount(0);
  await page.reload();
  await expect(
    decisions.getByRole("listitem").filter({ hasText: "Original scope" }),
  ).toContainText("Superseded");
  await expect(
    decisions.getByRole("listitem").filter({ hasText: "New scope" }),
  ).toContainText("Valid");
  await page.getByRole("button", { name: "Remove supersession" }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(preview).toContainText("Superseded → Valid");
  await page.getByRole("button", { name: "Confirm removal" }).click();
  await page.reload();
  await expect(
    decisions.getByRole("listitem").filter({ hasText: "Original scope" }),
  ).toContainText("Valid");
  await expect(
    decisions.getByRole("listitem").filter({ hasText: "New scope" }),
  ).toContainText("Valid");
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    (
      await new AxeBuilder({ page })
        .include('section[aria-label="Decisions"]')
        .analyze()
    ).violations,
  ).toEqual([]);
});
