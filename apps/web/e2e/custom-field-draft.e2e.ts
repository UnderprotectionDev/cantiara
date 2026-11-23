import { expect, test } from "@playwright/test";

test("a rejected Custom field edit survives scrolling its field and Work out of the window", async ({
  page,
}) => {
  await page.goto("/e2e/custom-field-draft.html");
  const input = page.getByRole("textbox", {
    name: "Work 1 Field 1",
    exact: true,
  });
  await input.fill("Retain this draft");
  await page.getByRole("button", { name: "Leave field" }).focus();
  await expect(page.getByRole("alert")).toHaveText("Fixture write refused");
  const owner = page.locator("#main-content");
  await owner.evaluate((element) => {
    element.scrollTop = 70_000;
  });
  await expect
    .poll(() => owner.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(40_000);
  await expect(
    page.getByRole("heading", { name: "Work 2", exact: true }),
  ).toHaveCount(0);
  await expect(input).not.toBeInViewport();
  await owner.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(input).toHaveValue("Retain this draft");
  await expect(page.getByRole("alert")).toHaveText("Fixture write refused");
});
