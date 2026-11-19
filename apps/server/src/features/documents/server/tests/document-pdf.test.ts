import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { expect, it } from "vitest";
import { renderDocumentPdf } from "../document-pdf";

it("produces an isolated PDF from the frozen Document Markdown", async () => {
  const result = await renderDocumentPdf({
    documentId: "document",
    revision: 1,
    title: "Architecture",
    capturedAt: "2026-10-02T12:00:00.000Z",
    markdown:
      "# Architecture\n\n> Snapshot — Work: DOC-1 — 2026-10-02T12:00:00.000Z\n\nStatic text\n\n<script>fetch('http://127.0.0.1/private')</script>\n\n![Image](http://127.0.0.1/private)",
  });
  expect(Buffer.from(result, "base64").subarray(0, 5).toString()).toBe("%PDF-");
}, 30_000);

it("keeps raw HTML as visible text in the frozen PDF instead of rendering it", async () => {
  const result = await renderDocumentPdf({
    capturedAt: "2026-10-02T12:00:00.000Z",
    documentId: "document",
    markdown:
      "Visible text\n\n<strong>raw markup</strong>\n\n<script>raw-script-marker</script>",
    revision: 1,
    title: "Architecture",
  });
  const task = getDocument({
    data: new Uint8Array(Buffer.from(result, "base64")),
    useSystemFonts: true,
  });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    expect(text).toContain("Visible text");
    expect(text).toContain("<strong>raw markup</strong>");
    expect(text).toContain("<script>raw-script-marker</script>");
  } finally {
    await task.destroy();
  }
}, 30_000);
