import { expect, test } from "@playwright/test";

test("Notification Center keeps source context when its group heading scrolls outside the window", async ({
  page,
}) => {
  await page.goto("/e2e/notification-center-window.html");
  await expect(
    page.getByText("Action Required (500)", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Signal 001", { exact: true })).toBeInViewport();
  await page.locator("#main-content").evaluate((owner) => {
    owner.scrollTop = owner.scrollHeight;
  });
  const last = page.getByText("Signal 500", { exact: true });
  await expect(last).toBeInViewport();
  const row = page.getByRole("listitem").filter({ has: last });
  await expect(
    row.getByRole("button", { name: "Open source", exact: true }),
  ).toBeVisible();
  await expect(row.getByText("Work CAN-1", { exact: true })).toBeAttached();
  expect(await page.getByRole("listitem").count()).toBeLessThan(35);
});
