import { expect, test } from "@playwright/test";

test("revokes a session through the keyboard-accessible Account journey", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    "http://127.0.0.1:3100/__e2e/setup?fixture=account-sessions",
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
  await page.goto("/account");

  await expect(
    page.getByRole("heading", { name: "Sessions", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByText("Current", { exact: true })).toBeVisible();

  const revokeOthers = page.locator("header").getByRole("button", {
    name: "Revoke Other Sessions",
  });
  await revokeOthers.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("alertdialog", { name: "Revoke other sessions?" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(revokeOthers).toBeFocused();

  const otherSession = page
    .getByRole("listitem")
    .filter({ hasText: "Firefox on Linux" });
  const revokeSession = otherSession.getByRole("button", {
    name: "Revoke Session",
  });
  await revokeSession.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("alertdialog", {
    name: "Revoke this session?",
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText("Firefox on Linux will lose access immediately."),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Revoke Session" }).focus();
  await page.keyboard.press("Enter");

  await expect(otherSession).toHaveCount(0);
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByText("Firefox on macOS")).toBeVisible();
  await expect(page.getByText("Mozilla/5.0", { exact: false })).toHaveCount(0);
});
