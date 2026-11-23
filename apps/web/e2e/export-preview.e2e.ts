import { expect, test } from "@playwright/test";

const EXPORT_RECORD_COUNT = /10000 records leave/;

test("Export uses the preview scroll container and keeps the full supplied order", async ({
  page,
}) => {
  await page.goto("/e2e/export-preview.html");
  await page.getByRole("button", { name: EXPORT_RECORD_COUNT }).click();
  const list = page.getByRole("list", { name: "Records in this file" });
  await expect(
    list.getByText("Export record 10000", { exact: true }),
  ).toBeInViewport();
  const scrollBox = list.locator("..");
  await scrollBox.focus();
  await page.keyboard.press("End");
  await expect(
    list.getByText("Export record 1", { exact: true }),
  ).toBeInViewport();
  await expect(list.getByRole("listitem").last()).toHaveText("Export record 1");
  expect(await list.getByRole("listitem").count()).toBeLessThan(40);
  expect(await page.evaluate(() => document.scrollingElement?.scrollTop)).toBe(
    0,
  );
});
