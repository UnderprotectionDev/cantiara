import { expect, test } from "@playwright/test";

const DARK_CLASS_PATTERN = /dark/;
const DASHBOARD_URL_PATTERN = /\/dashboard$/;
const ROOT_URL_PATTERN = /\/$/;
const SUPPORT_REFERENCE_PATTERN =
  /^SUP-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;

interface E2ESessionCookie {
  domain: string;
  expires?: number;
  httpOnly: boolean;
  name: string;
  path: string;
  sameSite: "Lax" | "None" | "Strict";
  secure: boolean;
  value: string;
}

test("keeps browser suggestions unsaved and persists Account Preferences on Save", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    "http://127.0.0.1:3100/__e2e/setup?fixture=account-preferences",
  );
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

  await page.goto("/dashboard");
  await expect(page).toHaveURL(DASHBOARD_URL_PATTERN);
  await expect(
    page.getByRole("heading", { name: "Dashboard", level: 1 }),
  ).toBeVisible();

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

  await page.getByLabel("Locale").selectOption("de-DE");
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByRole("menuitem", { name: "Dark", exact: true }).click();
  await expect(page.getByLabel("Locale")).toHaveValue("de-DE");
  await expect(page.getByRole("combobox", { name: "Appearance" })).toHaveValue(
    "Dark",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("main").getByText("Preferences saved.", { exact: true }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Locale")).toHaveValue("de-DE");
  await expect(page.getByRole("combobox", { name: "Appearance" })).toHaveValue(
    "Dark",
  );

  await context.setOffline(true);
  await expect(page.getByRole("status")).toContainText("Disconnected");
  await expect(page.getByRole("status")).toContainText("Last successful save");
  await page.getByLabel("Locale").selectOption("fr-FR");
  await expect(page.getByRole("status")).toContainText("Unsaved risk");
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();

  await context.setOffline(false);
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeEnabled();

  await page.getByRole("button", { name: "Founder", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sign Out", exact: true }).click();
  await expect(page).toHaveURL(ROOT_URL_PATTERN);
  await expect(page.locator("html")).toHaveClass(DARK_CLASS_PATTERN);
  await expect(
    page.getByRole("button", { name: "Appearance", exact: true }),
  ).toHaveCount(0);
});

test("shows the current value when another session advances Account Preferences", async ({
  browser,
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    "http://127.0.0.1:3100/__e2e/setup?fixture=account-preferences-stale",
  );
  const setup = (await setupResponse.json()) as {
    cookie: E2ESessionCookie;
    otherCookie: E2ESessionCookie;
  };
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();

  try {
    await context.addCookies([setup.cookie]);
    await otherContext.addCookies([setup.otherCookie]);
    await page.goto("/account/preferences");
    await otherPage.goto("/account/preferences");

    await page.getByLabel("Locale").selectOption("tr-TR");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByRole("main").getByText("Preferences saved.", { exact: true }),
    ).toBeVisible();

    await otherPage.getByLabel("Locale").selectOption("de-DE");
    const staleResponsePromise = otherPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/rpc/saveAccountPreferences"),
    );
    await otherPage.getByRole("button", { name: "Save", exact: true }).click();
    const staleResponse = await staleResponsePromise;
    expect(staleResponse.status()).toBe(412);
    const supportReference =
      staleResponse.headers()["x-cantiara-support-reference"];
    expect(supportReference).toMatch(SUPPORT_REFERENCE_PATTERN);
    const status = otherPage
      .getByRole("status")
      .filter({ hasText: "Current value" });
    await expect(status).toContainText("Current value");
    await expect(status).toContainText("Revision 1");
    await expect(status).toContainText("tr-TR");
    const supportNotice = otherPage
      .getByRole("alert")
      .filter({ hasText: "Data was not written." });
    await otherPage.waitForTimeout(6500);
    await expect(supportNotice).toBeVisible();
    await expect(supportNotice).toContainText("Data was not written.");
    await expect(supportNotice).toContainText("Do not retry.");
    await expect(supportNotice).toContainText(
      `Support reference ${supportReference}`,
    );
    await expect(supportNotice).not.toContainText(
      "Support reference unavailable.",
    );
  } finally {
    await otherContext.close();
  }
});
