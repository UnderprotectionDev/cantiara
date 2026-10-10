import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
test("Risks persists founder fields and explicit acceptance, preserves drafts, and remains keyboard accessible", async ({
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
  await page.goto(`/projects/${setup.projectId}#overview`);
  await page
    .getByRole("link", { name: "Open source record: Risks", exact: true })
    .click();
  const region = page.getByRole("region", { name: "Risks", exact: true });
  await region.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Provider delay");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Approval may slip");
  await page.getByLabel("Impact", { exact: true }).fill("Delayed release");
  await page.getByLabel("Probability", { exact: true }).fill("Unknown");
  await page
    .getByLabel("Response/mitigation", { exact: true })
    .fill("Prepare fallback");
  await page.getByRole("button", { name: "Save", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Risk saved.", { exact: true })).toBeVisible();

  await region.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Dependency outage");
  await page
    .getByLabel("Impact", { exact: true })
    .fill("Manual fallback available");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Risk saved.", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Provider delay", exact: true }).click();
  const detail = page.getByRole("article", { name: "Risk", exact: true });
  await expect(detail).toContainText("Open");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByLabel("Impact", { exact: true })
    .fill("Unsaved provider edit");
  await region
    .getByRole("link", { name: "Dependency outage", exact: true })
    .click();
  await expect(detail).toContainText("Dependency outage");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Dependency outage",
  );
  await expect(page.getByLabel("Impact", { exact: true })).toHaveValue(
    "Manual fallback available",
  );
  await page
    .getByLabel("Impact", { exact: true })
    .fill("Fallback remains available");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Risk saved.", { exact: true })).toBeVisible();
  await expect(detail).toContainText("Fallback remains available");
  await region
    .getByRole("link", { name: "Provider delay", exact: true })
    .click();
  await expect(detail).toContainText("Delayed release");

  await page.reload();
  await expect(detail).toContainText("Prepare fallback");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Impact", { exact: true }).fill("Cancelled edit");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(detail).toContainText("Delayed release");
  await page.getByRole("button", { name: "Status", exact: true }).click();
  await page.getByLabel("Status", { exact: true }).selectOption("Accepted");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Enter a Rationale" }),
  ).toBeVisible();
  await page
    .getByLabel("Rationale", { exact: true })
    .fill("Known exposure is tolerable.");
  await page.route(
    "**/rpc/transitionProjectSourceRecord",
    (route) => route.fulfill({ status: 503, body: "Temporarily unavailable" }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Risk could not be saved" }),
  ).toBeVisible();
  await expect(page.getByLabel("Rationale", { exact: true })).toHaveValue(
    "Known exposure is tolerable.",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Risk status saved.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(detail).toContainText("Accepted");
  await expect(detail).toContainText("Known exposure is tolerable.");
  await expect(
    page.getByRole("link", { name: "Provider delay", exact: true }),
  ).toBeVisible();
  for (const life of ["Mitigating", "Occurred", "Resolved", "Open"]) {
    // biome-ignore lint/performance/noAwaitInLoops: Each browser transition waits for the preceding committed status.
    await page.getByRole("button", { name: "Status", exact: true }).click();
    await page.getByLabel("Status", { exact: true }).selectOption(life);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator("form")).toHaveCount(0);
    await expect(detail.getByText(life, { exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Impact", { exact: true }).fill("Short launch delay");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("form")).toHaveCount(0);
  await page.reload();
  await expect(detail).toContainText("Short launch delay");
  await expect(detail.getByText("Open", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Impact", { exact: true }).fill("My unsaved edit");
  const otherPage = await context.newPage();
  await otherPage.goto(page.url());
  await otherPage.getByRole("button", { name: "Edit", exact: true }).click();
  await otherPage
    .getByLabel("Impact", { exact: true })
    .fill("Newer saved impact");
  await otherPage.getByRole("button", { name: "Save", exact: true }).click();
  await expect(otherPage.locator("form")).toHaveCount(0);
  await otherPage.close();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Risk changed" }),
  ).toBeVisible();
  await expect(page.getByLabel("Impact", { exact: true })).toHaveValue(
    "My unsaved edit",
  );
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Impact", { exact: true })).toHaveValue(
    "Newer saved impact",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .include('section[aria-label="Risks"]')
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
