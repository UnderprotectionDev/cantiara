import type { WorkDuplicatePreview } from "@cantiara/api/work-templates";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { WorkDuplicatePreviewPanel } from "./work-duplicate-form";

const preview: WorkDuplicatePreview = {
  customFields: [
    {
      definitionId: "field-audience",
      label: "Release audience",
      selectedByDefault: true,
      type: "Text",
      value: { kind: "text", text: "Founders" },
    },
  ],
  fields: [
    {
      key: "title",
      label: "Title",
      selectedByDefault: true,
      value: "Prepare launch",
    },
    {
      key: "type",
      label: "Type",
      selectedByDefault: true,
      value: "Improvement",
    },
    {
      key: "description",
      label: "Description",
      selectedByDefault: true,
      value: "Source description",
    },
    {
      key: "checklist",
      label: "Checklist",
      selectedByDefault: true,
      value: [{ completed: true, id: "check-1", text: "Keep context" }],
    },
  ],
  previewId: "preview-1",
  sourceWork: {
    id: "work-1",
    key: "REL-1",
    revision: 3,
    title: "Prepare launch",
  },
};

describe("Duplicate Work preview", () => {
  test("shows selectable copy fields and names every excluded lifecycle category", () => {
    const html = renderToStaticMarkup(
      createElement(WorkDuplicatePreviewPanel, {
        disabled: false,
        onCancel: vi.fn(),
        onConfirm: vi.fn(),
        preview,
      }),
    );

    for (const visible of [
      "Duplicate Work preview",
      "Title",
      "Prepare launch",
      "Type",
      "Improvement",
      "Description",
      "Source description",
      "Checklist",
      "1 item",
      "Completed: Keep context",
      "Release audience",
      "Founders",
      "Current status",
      "Close outcome",
      "Planning memberships",
      "Relations",
      "History",
      "Absolute dates",
      "Date Custom fields",
      "Confirm Duplicate",
      "Cancel",
    ]) {
      expect(html).toContain(visible);
    }
  });
});
