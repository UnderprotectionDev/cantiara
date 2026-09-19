import { expect, test } from "@playwright/test";

const DARK_CLASS_PATTERN = /dark/;
const PROJECTS_URL_PATTERN = /\/projects$/;
const ROOT_URL_PATTERN = /\/$/;
const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
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
    `${E2E_SERVER_URL}/__e2e/setup?fixture=account-preferences`,
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

  await page.goto("/projects");
  await expect(page).toHaveURL(PROJECTS_URL_PATTERN);
  await expect(
    page.getByRole("heading", { name: "Projects", level: 1 }),
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

  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByRole("menuitem", { name: "Dark", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Appearance" })).toHaveValue(
    "Dark",
  );
  await page.reload();
  await expect(page.getByLabel("Locale")).toHaveValue("tr-TR");
  await expect(page.getByRole("combobox", { name: "Appearance" })).toHaveValue(
    "Dark",
  );
  await page.getByLabel("Locale").selectOption("de-DE");
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
    `${E2E_SERVER_URL}/__e2e/setup?fixture=account-preferences-stale`,
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
    const pagePreferencesResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/rpc/accountPreferences"),
    );
    const otherPreferencesResponsePromise = otherPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/rpc/accountPreferences"),
    );
    await Promise.all([
      page.goto("/account/preferences"),
      otherPage.goto("/account/preferences"),
      pagePreferencesResponsePromise,
      otherPreferencesResponsePromise,
    ]);
    await expect(page.getByLabel("Locale")).toHaveValue("en-GB");
    await expect(otherPage.getByLabel("Locale")).toHaveValue("en-GB");

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
    await expect(status).toContainText("Data was not written.");
    await expect(status).toContainText(
      "This page is out of date. Refresh to load the current value.",
    );
    await expect(status.getByText("Revision", { exact: true })).toBeVisible();
    await expect(status.getByText("1", { exact: true })).toBeVisible();
    await expect(status.getByText("Appearance", { exact: true })).toBeVisible();
    await expect(status.getByText("Locale", { exact: true })).toBeVisible();
    await expect(status.getByText("Time zone", { exact: true })).toBeVisible();
    await expect(
      status.getByText("Date format", { exact: true }),
    ).toBeVisible();
    await expect(
      status.getByText("First day of week", { exact: true }),
    ).toBeVisible();
    await expect(status).toContainText("tr-TR");
    const supportNotice = otherPage
      .getByRole("alert")
      .filter({ hasText: "Data was not written." });
    await otherPage.waitForTimeout(6500);
    await expect(supportNotice).toBeVisible();
    await expect(supportNotice).toContainText("Data was not written.");
    const supportToast = otherPage
      .getByRole("status")
      .filter({ hasText: "Data was not written." });
    await expect(supportToast).toContainText("This page is out of date.");
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

test("does not submit dirty values against a newer Account Preferences revision", async ({
  browser,
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=account-preferences-revision-race`,
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
    await otherPage.getByLabel("Time zone").selectOption("America/Los_Angeles");
    await otherPage.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      otherPage.getByRole("main").getByText("Preferences saved.", {
        exact: true,
      }),
    ).toBeVisible();

    const refreshResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/rpc/accountPreferences"),
    );
    await page.evaluate(() => {
      window.dispatchEvent(new Event("visibilitychange"));
    });
    await refreshResponsePromise;

    const staleResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/rpc/saveAccountPreferences"),
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const staleResponse = await staleResponsePromise;

    expect(staleResponse.status()).toBe(412);
    await expect(
      page.getByRole("status").filter({ hasText: "Current value" }),
    ).toBeVisible();
    await otherPage.reload();
    await expect(otherPage.getByLabel("Time zone")).toHaveValue(
      "America/Los_Angeles",
    );
  } finally {
    await otherContext.close();
  }
});
