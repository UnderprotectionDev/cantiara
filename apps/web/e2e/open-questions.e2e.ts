import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
test("Uncertainty Records creates, answers without evidence, preserves cancelled and failed drafts, and retains closure history", async ({
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
  await page.goto(`/projects/${setup.projectId}#project-area-discovery`);
  const region = page.getByRole("region", {
    name: "Open Question",
    exact: true,
  });
  await region.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Preferred cadence");
  await page
    .getByLabel("Question", { exact: true })
    .fill("Which cadence do founders prefer?");
  await page
    .getByLabel("Context (optional)", { exact: true })
    .fill("Pilot review");
  await page.getByRole("button", { name: "Save", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Open Question saved.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Preferred cadence", exact: true })
    .click();
  const detail = page.getByRole("article", {
    name: "Open Question",
    exact: true,
  });
  await expect(detail).toContainText("Open");
  await page.getByRole("button", { name: "Answered", exact: true }).click();
  await page.getByLabel("Answer", { exact: true }).fill("Cancelled answer");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(detail).not.toContainText("Cancelled answer");
  await page.getByRole("button", { name: "Answered", exact: true }).click();
  await page.getByLabel("Answer", { exact: true }).fill("Weekly");
  await page
    .getByLabel("Rationale (optional)", { exact: true })
    .fill("Three interviews agreed");
  await page.route(
    "**/rpc/transitionProjectSourceRecord",
    (route) => route.fulfill({ status: 503, body: "Temporarily unavailable" }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Open Question could not be saved" }),
  ).toBeVisible();
  await expect(page.getByLabel("Answer", { exact: true })).toHaveValue(
    "Weekly",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(detail).toContainText("Answered");
  await expect(detail).toContainText("No evidence linked.");
  await page.reload();
  await expect(detail).toContainText("Weekly");
  await expect(detail).toContainText("Three interviews agreed");
  await page
    .getByRole("button", { name: "No longer applicable", exact: true })
    .click();
  await expect(detail).toContainText("No longer applicable");
  await page.reload();
  await expect(detail).toContainText("Which cadence do founders prefer?");
  await expect(detail).toContainText("Weekly");
  await expect(detail).toContainText("Three interviews agreed");
  await expect(detail.getByRole("button")).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .include('section[aria-label="Open Question"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(detail).toBeVisible();
  await detail.screenshot({ path: "../../.context/open-question-closed.png" });
});

test("Uncertainty Records keeps exact Document evidence and can close an unanswered question", async ({
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
  await page.goto(`/projects/${setup.projectId}#documents`);
  await page
    .getByRole("button", { name: "Create Document", exact: true })
    .click();
  const create = page.getByRole("dialog", { name: "Create Document" });
  await create.getByLabel("Title").fill("Pilot evidence");
  await create
    .getByRole("button", { name: "Create Document", exact: true })
    .click();
  const editor = page.getByRole("region", { name: "Document", exact: true });
  await editor.getByRole("tab", { name: "Markdown", exact: true }).click();
  await editor
    .getByRole("textbox", { name: "Markdown source" })
    .fill("Three founders prefer weekly reviews.");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    editor.getByRole("button", { name: "Save", exact: true }),
  ).toBeEnabled();
  await page.goto(`/projects/${setup.projectId}#project-area-discovery`);
  await page
    .getByRole("region", { name: "Open Question", exact: true })
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Cadence with evidence");
  await page.getByLabel("Question", { exact: true }).fill("Which cadence?");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("link", { name: "Cadence with evidence", exact: true })
    .click();
  await page.getByRole("button", { name: "Answered", exact: true }).click();
  await page.getByLabel("Answer", { exact: true }).fill("Weekly");
  await page
    .getByLabel("Evidence (optional)", { exact: true })
    .selectOption({ label: "Pilot evidence — Version 2" });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const detail = page.getByRole("article", {
    name: "Open Question",
    exact: true,
  });
  await expect(detail).toContainText("Three founders prefer weekly reviews.");
  await page
    .getByRole("button", { name: "No longer applicable", exact: true })
    .click();
  await page.reload();
  await expect(detail).toContainText("Version 2");
  await expect(detail).toContainText("Weekly");
  await expect(detail).toContainText("Three founders prefer weekly reviews.");
  await page
    .getByRole("region", { name: "Open Question", exact: true })
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Unused question");
  await page
    .getByLabel("Question", { exact: true })
    .fill("Do we still need this pilot?");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("link", { name: "Unused question", exact: true })
    .click();
  await page
    .getByRole("button", { name: "No longer applicable", exact: true })
    .click();
  await page.reload();
  await expect(detail).toContainText("Do we still need this pilot?");
  await expect(detail).toContainText("No longer applicable");
});
