import { expect, test } from "@playwright/test";

test("Calendar keeps a pointer drag source mounted outside a busy day window", async ({
  page,
}) => {
  await page.goto("/e2e/calendar-window.html");
  const source = page.getByRole("button", {
    exact: true,
    name: "Target date for Work 001",
  });
  await expect(source).toBeInViewport();
  const bounds = await source.boundingBox();
  if (!bounds) {
    throw new Error("Calendar drag source is outside the viewport");
  }
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width / 2 + 12,
    bounds.y + bounds.height / 2,
  );
  await expect(source).toHaveCSS("opacity", "0.45");
  await page
    .getByRole("button", { name: "Outside Calendar" })
    .evaluate((button) => button.focus({ preventScroll: true }));
  const owner = page.locator("#main-content");
  await owner.evaluate((element) => {
    element.scrollTop = 3500;
  });
  await expect
    .poll(() => owner.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(3000);
  await expect(
    page.getByRole("button", { exact: true, name: "Target date for Work 002" }),
  ).toHaveCount(0);
  await expect(source).toHaveCSS("opacity", "0.45");
  await page.mouse.up();
});
