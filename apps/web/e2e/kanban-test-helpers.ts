import { expect, type Page } from "@playwright/test";

export const OPEN_SOURCE_RECORD_BUTTON_NAME = /^Open source record/;

export async function openWorkRecordFromKanbanList(page: Page, title?: string) {
  await page.getByRole("button", { name: "List", exact: true }).click();

  const workRows = page
    .getByRole("region", { name: "List" })
    .getByRole("listitem");
  const workRow = title
    ? workRows.filter({ hasText: title })
    : workRows.first();

  const sourceViewUrl = page.url();
  await workRow
    .getByRole("button", { name: OPEN_SOURCE_RECORD_BUTTON_NAME })
    .click();

  const preview = page.getByRole("dialog");
  await expect(preview).toBeVisible();
  await expect(page).toHaveURL(sourceViewUrl);

  const fullPageLink = preview.getByRole("link", {
    exact: true,
    name: "Open full page",
  });
  const fullPageHref = await fullPageLink.getAttribute("href");
  if (!fullPageHref) {
    throw new Error("The Work preview has no full-page destination.");
  }

  await fullPageLink.click();
  await expect(page).toHaveURL(new URL(fullPageHref, sourceViewUrl).href);
}
