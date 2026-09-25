import type { Page } from "@playwright/test";

export async function openWorkRecordFromKanbanList(page: Page, title?: string) {
  await page.getByRole("button", { name: "List", exact: true }).click();

  const workRows = page
    .getByRole("region", { name: "List" })
    .getByRole("listitem");
  const workRow = title
    ? workRows.filter({ hasText: title })
    : workRows.first();

  await workRow.getByRole("link", { name: "Open source record" }).click();
}
