import { expect, test } from "@playwright/test";

const DARK_CLASS_PATTERN = /dark/;

test("keeps browser suggestions unsaved and persists Account Preferences on Save", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get("http://127.0.0.1:3100/__e2e/setup");
  const setup = (await setupResponse.json()) as {
    cookie: {
      domain: string;
      expires?: number;
      httpOnly: boolean;
      name: string;
      path: string;
      sameSite: "Lax" | "None" | "Strict";
      secure: boolean;
      value: string;
    };
  };
  await context.addCookies([setup.cookie]);

  await page.goto("/account/preferences");
  await expect(
    page.getByRole("heading", { name: "Preferences", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Use suggested locale and time zone",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Locale")).toHaveValue("en-GB");
  await expect(page.getByLabel("Time zone")).toHaveValue("Europe/Istanbul");
  const previewTimestamp = page.locator(
    'time[datetime="2026-09-16T09:00:00.000Z"]',
  );
  await expect(previewTimestamp).toHaveAttribute(
    "datetime",
    "2026-09-16T09:00:00.000Z",
  );
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeVisible();

  await page.getByLabel("Time zone").selectOption("America/Los_Angeles");
  await expect(
    page.getByRole("heading", { name: "Preview", level: 2 }),
  ).toBeVisible();
  await page.getByLabel("Time zone").selectOption("Europe/Istanbul");

  await page
    .getByRole("button", { name: "Use suggested locale and time zone" })
    .focus();
  await page.keyboard.press("Enter");
  await page.reload();
  await expect(page.getByLabel("Locale")).toHaveValue("en-GB");
  await expect(page.getByLabel("Time zone")).toHaveValue("Europe/Istanbul");

  await page.getByLabel("Locale").selectOption("tr-TR");
  await page.getByLabel("Time zone").selectOption("America/Los_Angeles");
  await page.getByLabel("Date format").selectOption("yyyy-MM-dd");
  await page.getByLabel("First day of week").selectOption("Sunday");
  await page
    .getByRole("combobox", { name: "Appearance" })
    .selectOption("Light");
  await page.getByRole("button", { name: "Save", exact: true }).focus();
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("main").getByText("Preferences saved.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("2026-09-16 02:00", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1.234.567,89", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Ship the launch", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: "Week" })).toContainText("Paz");
  await expect(page.getByText("System", { exact: true })).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveClass(DARK_CLASS_PATTERN);

  await page.reload();
  await expect(page.getByLabel("Locale")).toHaveValue("tr-TR");
  await expect(page.getByLabel("Time zone")).toHaveValue("America/Los_Angeles");
  await expect(page.getByLabel("Date format")).toHaveValue("yyyy-MM-dd");
  await expect(page.getByLabel("First day of week")).toHaveValue("Sunday");
  await expect(page.getByRole("combobox", { name: "Appearance" })).toHaveValue(
    "Light",
  );
  await expect(
    page.getByRole("button", {
      name: "Use suggested locale and time zone",
    }),
  ).toHaveCount(0);

  await expect(previewTimestamp).toHaveAttribute(
    "datetime",
    "2026-09-16T09:00:00.000Z",
  );

  await context.setOffline(true);
  await expect(page.getByRole("status")).toContainText("Disconnected");
  await expect(page.getByRole("status")).toContainText("Last successful save");
  await page.getByLabel("Locale").selectOption("de-DE");
  await expect(page.getByRole("status")).toContainText("Unsaved risk");
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();

  await context.setOffline(false);
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeEnabled();
});
