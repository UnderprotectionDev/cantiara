import type { DocumentSnapshot } from "@cantiara/api/document-transfer";
import { DocumentTransferError } from "@cantiara/api/document-transfer";
import { describe, expect, it, vi } from "vitest";

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(() =>
      Promise.resolve({
        close: vi.fn(async () => undefined),
        newContext: vi.fn(async () => ({
          newPage: vi.fn(async () => ({
            pdf: vi.fn(async () => Buffer.from("%PDF-mock")),
            setContent: vi.fn(async () => undefined),
            setDefaultTimeout: vi.fn(),
          })),
          route: vi.fn(async () => undefined),
        })),
      }),
    ),
  },
}));

const { renderDocumentPdf } = await import("./document-pdf");

function snapshot(markdown: string): DocumentSnapshot {
  return {
    capturedAt: "2026-10-02T12:00:00.000Z",
    documentId: "document",
    markdown,
    revision: 1,
    title: "Architecture",
  };
}

describe("Document PDF renderer limits", () => {
  it("rejects an oversized snapshot with a typed transfer error before launching a browser", async () => {
    await expect(
      renderDocumentPdf(snapshot("a".repeat(1_100_001))),
    ).rejects.toBeInstanceOf(DocumentTransferError);
    await expect(
      renderDocumentPdf(snapshot("a".repeat(1_100_001))),
    ).rejects.toThrow("PDF size limit");
  });

  it("rejects a third concurrent render with a typed busy error", async () => {
    const first = renderDocumentPdf(snapshot("# Architecture"));
    const second = renderDocumentPdf(snapshot("# Architecture"));
    await expect(renderDocumentPdf(snapshot("# Architecture"))).rejects.toThrow(
      "PDF export is busy. Try again shortly.",
    );
    await expect(
      renderDocumentPdf(snapshot("# Architecture")),
    ).rejects.toBeInstanceOf(DocumentTransferError);
    await expect(first).resolves.toBeTypeOf("string");
    await expect(second).resolves.toBeTypeOf("string");
  });
});
