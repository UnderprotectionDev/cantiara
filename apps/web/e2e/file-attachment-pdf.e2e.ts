import { expect, test } from "@playwright/test";

function onePagePdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  pdf += "xref\n0 4\n0000000000 65535 f \n";
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  return `${pdf}trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}

test("a malformed PDF fails inside the preview and Retry preview renders a valid response", async ({
  page,
}) => {
  const firstResponse = Promise.withResolvers<void>();
  let attempt = 0;
  await page.route("**/e2e/synthetic-attachment.pdf", async (route) => {
    attempt += 1;
    if (attempt === 1) {
      await firstResponse.promise;
      await route.fulfill({
        body: "%PDF-1.4\nmalformed",
        contentType: "application/pdf",
      });
      return;
    }
    await route.fulfill({ body: onePagePdf(), contentType: "application/pdf" });
  });
  await page.goto("/e2e/file-attachment-pdf.html");

  const preview = page.getByRole("article", { name: "Synthetic PDF" });
  const status = preview.getByRole("status");
  try {
    await expect(status).toHaveText("Loading PDF preview…");
  } finally {
    firstResponse.resolve();
  }
  await expect(preview.getByRole("alert")).toContainText(
    "PDF preview is unavailable. Download the original file instead.",
  );
  await expect(status).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "File Attachments" }),
  ).toBeVisible();
  await expect(preview.getByRole("button", { name: "Download" })).toBeEnabled();

  await preview.getByRole("button", { name: "Retry preview" }).click();
  await expect(
    preview.getByRole("img", { name: "PDF page 1 of 1" }).locator("canvas"),
  ).toBeVisible();
  await expect(status).toHaveCount(0);
  await expect(preview.getByRole("alert")).toHaveCount(0);
});
