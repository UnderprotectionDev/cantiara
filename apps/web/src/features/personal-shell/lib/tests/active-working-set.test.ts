import { describe, expect, test } from "vitest";
import { memberPreviewTarget } from "../active-working-set";

describe("Active Working Set reopen target", () => {
  test("opens a Work in its Project and a Document in its own scope", () => {
    expect(
      memberPreviewTarget({
        id: "w",
        kind: "Work",
        label: "W",
        projectId: "p",
      }),
    ).toEqual({ kind: "work", label: "W", projectId: "p", workId: "w" });
    expect(
      memberPreviewTarget({
        id: "d",
        kind: "Document",
        label: "D",
        projectId: null,
      }),
    ).toEqual({
      documentId: "d",
      kind: "document",
      label: "D",
      projectId: null,
    });
  });

  test("has no target for a Work without a Project", () => {
    expect(
      memberPreviewTarget({
        id: "w",
        kind: "Work",
        label: "W",
        projectId: null,
      }),
    ).toBeNull();
  });
});
