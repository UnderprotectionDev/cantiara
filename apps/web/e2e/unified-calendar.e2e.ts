import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { expect, type Page, test } from "@playwright/test";
import { formatAccountDate } from "../src/features/account-preferences/lib/account-preferences-format";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

async function dragDateTo(
  page: Page,
  dateMark: ReturnType<Page["getByRole"]>,
  day: ReturnType<Page["locator"]>,
) {
  const source = await dateMark.boundingBox();
  const target = await day.boundingBox();
  if (!(source && target)) {
    throw new Error("The date mark or target day is not visible.");
  }
  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    {
      steps: 5,
    },
  );
}

test("previews, cancels, saves, and undoes one Calendar date drag", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=unified-calendar`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
    projectId: string;
  };
  await context.addCookies([setup.cookie]);
  await page.goto(
    `/calendar?calendarDay=2026-10-01&projectId=${setup.projectId}&view=Week`,
  );

  const originalDay = page.locator('[data-calendar-day="2026-10-03"]');
  const destinationDay = page.locator('[data-calendar-day="2026-10-04"]');
  const dateMark = page.getByRole("button", {
    name: "Target date for Calendar date check",
  });
  await expect(dateMark).toBeVisible();
  await expect(
    originalDay.getByText("Target date", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator('[data-calendar-day="2026-10-01"]')
      .getByText("Planned start", {
        exact: true,
      }),
  ).toBeVisible();
  await expect(
    page
      .locator('[data-calendar-day="2026-10-02"]')
      .getByText("Reappear date", {
        exact: true,
      }),
  ).toBeVisible();

  await dateMark.focus();
  await page.keyboard.press("Space");
  await expect(dateMark).toHaveCSS("opacity", "0.45");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
  await page.keyboard.press("ArrowRight");
  const preview = page.locator('p[role="status"]').filter({
    hasText: "Target date for Calendar date check",
  });
  await expect(preview).toContainText(
    formatAccountDate("2026-10-03", DEFAULT_ACCOUNT_PREFERENCES),
  );
  await expect(preview).toContainText(
    formatAccountDate("2026-10-04", DEFAULT_ACCOUNT_PREFERENCES),
  );
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
  await expect(
    originalDay.getByText("Target date", { exact: true }),
  ).toBeVisible();
  await expect(
    destinationDay.getByText("Target date", { exact: true }),
  ).toHaveCount(0);

  await dragDateTo(page, dateMark, destinationDay);
  await expect(preview).toContainText("Target date");
  await expect(preview).toContainText(
    formatAccountDate("2026-10-03", DEFAULT_ACCOUNT_PREFERENCES),
  );
  await expect(preview).toContainText(
    formatAccountDate("2026-10-04", DEFAULT_ACCOUNT_PREFERENCES),
  );
  await page.mouse.up();

  await expect(
    destinationDay.getByText("Target date", { exact: true }),
  ).toBeVisible();
  await expect(
    originalDay.getByText("Target date", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator('[data-calendar-day="2026-10-01"]')
      .getByText("Planned start", {
        exact: true,
      }),
  ).toBeVisible();
  await expect(
    page
      .locator('[data-calendar-day="2026-10-02"]')
      .getByText("Reappear date", {
        exact: true,
      }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    originalDay.getByText("Target date", { exact: true }),
  ).toBeVisible();
  await expect(
    destinationDay.getByText("Target date", { exact: true }),
  ).toHaveCount(0);
});
