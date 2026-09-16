import { expect, test } from "@playwright/test";

test("shows the online-only empty state after the connection is lost", async ({
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
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Dashboard", level: 1 }),
  ).toBeVisible();

  await context.setOffline(true);

  const offlineState = page.getByRole("status");
  await expect(offlineState).toBeVisible();
  await expect(offlineState).toContainText("You’re offline");
  await expect(offlineState).toContainText("Last saved");
  await expect(offlineState).not.toContainText("Unsaved changes may be lost");
  await expect(
    page.getByRole("heading", { name: "Dashboard", level: 1 }),
  ).toHaveCount(0);
  await expect(page.getByText("Welcome Founder")).toHaveCount(0);

  await context.setOffline(false);
  await expect(offlineState).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Dashboard", level: 1 }),
  ).toBeVisible();
});
