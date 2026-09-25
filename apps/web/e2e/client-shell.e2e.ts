import { expect, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const LOGIN_URL_PATTERN = /\/login$/;
const PROJECTS_URL_PATTERN = /\/projects$/;
const PROJECT_WORK_URL_PATTERN = /\/projects\/[^/?#]+#work$/;

test("shows the online-only empty state after the connection is lost", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=client-shell`,
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
  await expect(
    page.getByRole("heading", { name: "Projects", level: 1 }),
  ).toBeVisible();

  await context.setOffline(true);
  await page.waitForFunction(() => navigator.onLine === false);
  // Chromium can update navigator.onLine before dispatching the DOM event in CI.
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));

  const offlineState = page.getByRole("status");
  await expect(offlineState).toBeVisible();
  await expect(offlineState).toContainText("You’re offline");
  await expect(offlineState).toContainText("Last saved");
  await expect(offlineState).not.toContainText("Unsaved changes may be lost");
  await expect(
    page.getByRole("heading", { name: "Projects", level: 1 }),
  ).toHaveCount(0);
  await expect(page.getByText("Welcome Founder")).toHaveCount(0);

  await context.setOffline(false);
  await page.waitForFunction(() => navigator.onLine === true);
  // Keep the reconnect path deterministic for the same browser event boundary.
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(offlineState).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Projects", level: 1 }),
  ).toBeVisible();
});

test("routes the product entry into Account Access and skips app navigation by keyboard", async ({
  context,
  page,
  request,
}) => {
  await page.goto("/");

  await expect(page).toHaveURL(LOGIN_URL_PATTERN);
  await expect(
    page.getByRole("heading", { name: "Welcome to Cantiara" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "API Status" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Continue with GitHub" }),
  ).toHaveCount(1);

  const skipLink = page.getByRole("button", {
    name: "Skip to main content",
  });
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=account-sessions`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([setup.cookie]);

  await page.goto("/");
  await expect(page).toHaveURL(PROJECTS_URL_PATTERN);
  await expect(
    page.getByRole("heading", { name: "Projects", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }),
  ).toBeVisible();
  const authenticatedSkipLink = page.getByRole("button", {
    name: "Skip to main content",
  });
  await page.keyboard.press("Tab");
  await expect(authenticatedSkipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("recovers from a failed session check with an explicit retry", async ({
  page,
}) => {
  let sessionAttempts = 0;
  await page.route("**/api/auth/get-session", async (route) => {
    sessionAttempts += 1;
    if (sessionAttempts === 1) {
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.goto("/projects");

  await expect(page.getByRole("alert")).toContainText(
    "Cantiara couldn’t be reached.",
  );
  await expect(page.getByText("Support reference unavailable.")).toBeVisible();
  await page.getByRole("button", { name: "Retry" }).click();

  await expect(page).toHaveURL(LOGIN_URL_PATTERN);
  await expect(
    page.getByRole("heading", { name: "Welcome to Cantiara" }),
  ).toBeVisible();
});

test("keeps the active Project surface when skipping app navigation by keyboard", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=work-lifecycle`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([setup.cookie]);

  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Skip Link Acceptance");
  await page.getByRole("button", { name: "Create Project" }).click();
  await expect(page).toHaveURL(PROJECTS_URL_PATTERN);
  await page
    .getByRole("link", { name: "Skip Link Acceptance", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { exact: true, name: "Work" })
    .click();
  await expect(page).toHaveURL(PROJECT_WORK_URL_PATTERN);

  const skipLink = page.getByRole("button", {
    name: "Skip to main content",
  });
  await skipLink.focus();
  await page.keyboard.press("Enter");

  await expect(page.locator("#main-content")).toBeFocused();
  await expect(page).toHaveURL(PROJECT_WORK_URL_PATTERN);
});
