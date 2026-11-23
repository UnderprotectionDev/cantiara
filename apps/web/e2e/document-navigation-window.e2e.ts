import { expect, test } from "@playwright/test";

test("Documents opens the far-off hash target without mounting the whole Folder", async ({
  page,
}) => {
  await page.goto("/e2e/document-navigation-window.html#document-doc-350");
  const navigation = page.getByRole("navigation", { name: "Documents" });
  const target = navigation.getByRole("button", {
    exact: true,
    name: "Document 350",
  });
  await expect(target).toBeInViewport();
  await expect(target).toHaveAttribute("aria-current", "page");
  await expect(target).toHaveAccessibleDescription(
    "Personal Wiki Child of Document 349",
  );
  expect(await navigation.getByRole("button").count()).toBeLessThan(50);
});
