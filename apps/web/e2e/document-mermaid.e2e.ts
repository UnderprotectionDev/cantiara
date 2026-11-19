import { expect, test } from "@playwright/test";

test("Document Mermaid keeps supported edge IDs and exposes invalid legacy source without rewriting it", async ({
  page,
}) => {
  const valid = "flowchart LR\nA edge_1@--> B";
  await page.goto(
    `/e2e/document-mermaid.html?mermaid=${encodeURIComponent(valid)}`,
  );
  await expect(
    page.getByRole("img", { name: "Mermaid diagram" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  const invalid = "flowchart LR\nA edge[1]@--> B";
  await page.goto(
    `/e2e/document-mermaid.html?mermaid=${encodeURIComponent(invalid)}`,
  );
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator("pre")).toContainText(invalid);
  await expect(page.getByRole("img", { name: "Mermaid diagram" })).toHaveCount(
    0,
  );
});
