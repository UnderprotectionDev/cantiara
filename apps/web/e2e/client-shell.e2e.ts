import { expect, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

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

test("recovers the API status when the server is still starting", async ({
  page,
}) => {
  let healthCheckAttempts = 0;

  await page.route("**/rpc/healthCheck", async (route) => {
    healthCheckAttempts += 1;
    if (healthCheckAttempts === 1) {
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "API Status" })).toBeVisible();
  await expect(page.getByText("Connected", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("You’re offline", { exact: true })).toHaveCount(
    0,
  );
  expect(healthCheckAttempts).toBeGreaterThanOrEqual(2);
});
