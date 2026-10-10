// biome-ignore-all lint/performance/noAwaitInLoops: The browser must visit each Consent state in order.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
test("Research Session consent context persists, preserves cancelled drafts, and supports keyboard retry", async ({
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
  const sessions = page.getByRole("region", {
    name: "Research Sessions",
    exact: true,
  });
  await sessions
    .getByRole("button", { name: "Create Research Session", exact: true })
    .click();
  await sessions.getByLabel("Title", { exact: true }).fill("Export interview");
  await sessions
    .getByLabel("Purpose", { exact: true })
    .fill("Understand export needs");
  await sessions
    .getByLabel("Question guide (optional)", { exact: true })
    .fill("Which formats do you use?");
  await sessions
    .getByLabel("Consent", { exact: true })
    .selectOption("Not allowed");
  await expect(sessions).toContainText(
    "Participant quotes, identifying personal notes, file attachments, sharing and publishing are closed.",
  );
  await page.route(
    "**/rpc/saveResearchSession",
    (route) => route.fulfill({ status: 503, body: "Temporarily unavailable" }),
    { times: 1 },
  );
  await sessions.getByRole("button", { name: "Save", exact: true }).click();
  await expect(sessions.getByRole("alert")).toContainText("could not be saved");
  await expect(sessions.getByLabel("Purpose", { exact: true })).toHaveValue(
    "Understand export needs",
  );
  await sessions.getByRole("button", { name: "Retry", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(sessions).toContainText("Research Session saved.");
  await page.reload();
  await expect(sessions).toContainText("Not allowed");
  await sessions.getByRole("button", { name: "Edit", exact: true }).click();
  await sessions.getByLabel("Consent", { exact: true }).selectOption("Allowed");
  await sessions.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  await expect(sessions).toContainText("Not allowed");
  await sessions.getByRole("button", { name: "Edit", exact: true }).click();
  for (const consent of [
    "Not asked",
    "Allowed",
    "Not allowed",
    "Not applicable",
  ]) {
    await sessions.getByLabel("Consent", { exact: true }).selectOption(consent);
    await expect(sessions).toContainText(
      consent === "Allowed" || consent === "Not applicable"
        ? "Convert still requires a preview."
        : "sharing and publishing are closed.",
    );
  }
  await sessions
    .getByLabel("Status", { exact: true })
    .selectOption("Completed");
  const audit = await new AxeBuilder({ page })
    .include('[aria-label="Research Sessions"]')
    .analyze();
  expect(audit.violations).toEqual([]);
  await sessions.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  await expect(sessions).toContainText("Completed · Consent: Not applicable");
  await sessions.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(
    sessions.getByLabel("Question guide (optional)", { exact: true }),
  ).toHaveValue("Which formats do you use?");
  await expect(
    sessions.getByLabel("Time (optional)", { exact: true }),
  ).toHaveValue("2026-10-10T14:00");
  await expect(
    sessions.getByLabel("Duration (minutes, optional)", { exact: true }),
  ).toHaveValue("45");
});
