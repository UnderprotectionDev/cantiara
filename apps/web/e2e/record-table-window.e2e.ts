import { expect, test } from "@playwright/test";

test("Record Discovery windows the sorted Table in the route's vertical scroll owner", async ({
  page,
}) => {
  await page.goto("/e2e/record-table-window.html");
  const table = page.getByRole("table");
  const titleField = (title: string) =>
    table.getByRole("textbox", {
      exact: true,
      name: `Edit Title for Decision ${title}`,
    });

  await expect(titleField("500")).toBeVisible();
  await table.getByRole("button", { name: "Sort by Title" }).click();
  await expect(titleField("001")).toBeVisible();
  expect(await table.getByRole("row").count()).toBeLessThan(40);
  await page.locator("#main-content").evaluate((owner) => {
    const scrollTarget = owner.querySelector("table");
    if (scrollTarget) {
      owner.scrollTop =
        scrollTarget.offsetTop + scrollTarget.offsetHeight - owner.clientHeight;
    }
  });
  await expect(titleField("500")).toBeInViewport();
  expect(await table.getByRole("row").count()).toBeLessThan(40);
});

test("a rejected cell keeps its draft when its row leaves the viewport", async ({
  page,
}) => {
  await page.goto("/e2e/record-table-window.html");
  const title = page.getByRole("textbox", {
    exact: true,
    name: "Edit Title for Decision 500",
  });
  await title.fill("Unsaved decision");
  await page.getByRole("searchbox", { name: "Filter rows" }).focus();
  await page.locator("#main-content").evaluate((owner) => {
    owner.scrollTop = owner.scrollHeight;
  });
  await expect(
    page.getByRole("textbox", {
      exact: true,
      name: "Edit Title for Decision 001",
    }),
  ).toBeInViewport();
  await page.locator("#main-content").evaluate((owner) => {
    owner.scrollTop = 0;
  });
  await expect(title).toHaveValue("Unsaved decision", { timeout: 3000 });
});
