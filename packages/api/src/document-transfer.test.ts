import { describe, expect, it } from "vitest";
import {
  freezeDocumentLiveBlocks,
  selectDocumentMove,
} from "./document-transfer";

describe("Documents move and export seam", () => {
  it("moves only the root and explicitly selected descendants", () => {
    const records = [
      { id: "root", parentDocumentId: null },
      { id: "child", parentDocumentId: "root" },
      { id: "grandchild", parentDocumentId: "child" },
      { id: "other", parentDocumentId: null },
    ];
    expect(selectDocumentMove(records, "root", ["grandchild"])).toEqual([
      "root",
      "grandchild",
    ]);
    expect(() => selectDocumentMove(records, "root", ["other"])).toThrow();
    expect(() =>
      selectDocumentMove(records, "root", ["child", "child"]),
    ).toThrow();
  });

  it("freezes live blocks with a dated source label, leaving fenced examples untouched", async () => {
    const body =
      ':::live-work{workId="work-1"}\n\n```text\n:::live-work{workId="example"}\n```';
    const result = await freezeDocumentLiveBlocks(
      body,
      "2026-10-02T12:00:00.000Z",
      async () => ({
        label: "DOC-1 Ship export",
        text: "Status: In progress",
      }),
    );
    expect(result).toContain("Snapshot — Work: DOC-1 Ship export");
    expect(result).toContain("2026-10-02T12:00:00.000Z");
    expect(result).toContain("Status: In progress");
    expect(result).not.toContain('workId="work-1"');
    expect(result).toContain('workId="example"');
  });

  it("bounds cycles and refuses an export that expands too many live sources", async () => {
    const block = ':::live-section{documentId="source" sectionId="summary"}';
    const cycle = await freezeDocumentLiveBlocks(
      block,
      "2026-10-02T12:00:00.000Z",
      () => Promise.resolve({ label: "Source / Summary", text: block }),
    );
    expect(cycle).toContain("Source unavailable.");
    await expect(
      freezeDocumentLiveBlocks(
        Array.from({ length: 201 }, () => ':::live-work{workId="source"}').join(
          "\n",
        ),
        "2026-10-02T12:00:00.000Z",
        () => Promise.resolve({ label: "Source", text: "Static" }),
      ),
    ).rejects.toThrow("live block limit");
  });
});
