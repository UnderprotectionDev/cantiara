import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import WorkChecklist from "./work-checklist";

describe("Work Checklists", () => {
  test("renders owned checklist item controls without Work lifecycle fields", () => {
    const html = renderToStaticMarkup(
      createElement(WorkChecklist, {
        checklist: [
          { completed: true, id: "item-1", text: "Confirm the copy" },
          { completed: false, id: "item-2", text: "Publish the page" },
        ],
        disabled: false,
        onSave: vi.fn(),
        workKey: "PAY-1",
      }),
    );

    expect(html).toContain("Checklist");
    expect(html).toContain("Confirm the copy");
    expect(html).toContain("Publish the page");
    expect(html).toContain("1 of 2 complete");
    expect(html).toContain("Add item");
    expect(html).toContain("Save item");
    expect(html).toContain("Move up");
    expect(html).toContain("Move down");
    expect(html).toContain("Delete item");
    for (const forbiddenField of [
      "Due date",
      "Priority",
      "Relation",
      "Status for item",
      "Test Scenario",
      "Handoff",
    ]) {
      expect(html).not.toContain(forbiddenField);
    }
  });

  test("keeps an empty checklist available without gating the parent Work", () => {
    const html = renderToStaticMarkup(
      createElement(WorkChecklist, {
        checklist: [],
        disabled: false,
        onSave: vi.fn(),
        workKey: "PAY-1",
      }),
    );

    expect(html).toContain("Add the first small step for this Work.");
    expect(html).toContain("New item for PAY-1");
  });
});
