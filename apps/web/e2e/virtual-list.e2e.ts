import { expect, test } from "@playwright/test";

test("the route scroll owner measures rows and keeps the active draft while scrolling", async ({
  page,
}) => {
  await page.goto("/e2e/virtual-list.html");
  const list = page.getByRole("list", { name: "Records" });
  const first = list.getByRole("textbox", { exact: true, name: "Record 1" });
  const second = list.getByRole("textbox", { exact: true, name: "Record 2" });
  const initialTop = (await second.boundingBox())?.y ?? 0;
  await list.getByText("Details for Record 1", { exact: true }).click();
  await expect
    .poll(async () => (await second.boundingBox())?.y ?? 0)
    .toBeGreaterThan(initialTop + 100);
  await list.getByText("Details for Record 1", { exact: true }).click();

  await first.fill("Unsaved title");
  await page.locator("#main-content").evaluate((owner) => {
    owner.scrollTop = owner.scrollHeight;
  });
  await expect(
    list.getByRole("textbox", { exact: true, name: "Record 500" }),
  ).toBeInViewport();
  await expect(first).toBeFocused();
  await expect(first).toHaveValue("Unsaved title");
  expect(await list.getByRole("listitem").count()).toBeLessThan(40);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(second).toBeFocused();
});

test("a record deep link reveals a row beyond the initial route window", async ({
  page,
}) => {
  await page.goto("/e2e/virtual-list.html?row=row-350");
  await expect(
    page.getByRole("textbox", { exact: true, name: "Record 350" }),
  ).toBeInViewport();
});

test("Tab skips an unmounted row with no enabled controls", async ({
  page,
}) => {
  await page.goto("/e2e/virtual-list.html?read-only");
  const first = page.getByRole("textbox", { exact: true, name: "Record 1" });
  await first.focus();
  await page.locator("#main-content").evaluate((owner) => {
    owner.scrollTop = owner.scrollHeight;
  });
  await expect(
    page.getByRole("textbox", { exact: true, name: "Record 500" }),
  ).toBeInViewport();
  const disabled = page.getByRole("textbox", { exact: true, name: "Record 2" });
  await expect(disabled).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("textbox", { exact: true, name: "Record 3" }),
  ).toBeFocused();
});

test("a horizontal window reaches the last column without mounting every column", async ({
  page,
}) => {
  await page.goto("/e2e/virtual-list.html?horizontal");
  const list = page.getByRole("list", { name: "Records" });
  await expect(
    list.getByRole("textbox", { exact: true, name: "Record 1" }),
  ).toBeInViewport();
  await page.locator("#main-content").evaluate((owner) => {
    owner.scrollLeft = owner.scrollWidth;
  });
  await expect(
    list.getByRole("textbox", { exact: true, name: "Record 500" }),
  ).toBeInViewport();
  expect(await list.getByRole("listitem").count()).toBeLessThan(25);
});
