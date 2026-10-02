import { expect, it } from "vitest";
import { renderDocumentPdf } from "./document-pdf";

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
