import {
  CUSTOM_FIELD_RECORD_TYPE_OPTIONS,
  CUSTOM_FIELD_TYPE_OPTIONS,
  type CustomFieldDefinition,
} from "@cantiara/api/custom-fields";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { orpc } from "@/utils/orpc";
import CustomFieldEditor from "./custom-field-editor";

function renderEditor(projectId: string, definitions: CustomFieldDefinition[]) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(
    orpc.customFields.queryOptions({ input: { projectId } }).queryKey,
    definitions,
  );

  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(CustomFieldEditor, { projectId }),
    ),
  );
}

describe("Custom field editor", () => {
  test("renders the closed type and record binding catalogs without forbidden counterparts", () => {
    const html = renderEditor("project-1", []);

    for (const type of CUSTOM_FIELD_TYPE_OPTIONS) {
      expect(html).toContain(type);
    }
    for (const recordType of CUSTOM_FIELD_RECORD_TYPE_OPTIONS) {
      expect(html).toContain(recordType);
    }
    for (const forbidden of [
      "Lookup",
      "Formula",
      "Session Test",
      "Test assessment",
      "Markdown body",
      "Raw attachment",
      "Tag hierarchy",
      "Rename Tag",
      "Merge tags",
    ]) {
      expect(html).not.toContain(forbidden);
    }
  });

  test("shows the Project-local definitions returned by the seam", () => {
    const html = renderEditor("project-1", [
      {
        createdAt: "2026-09-19T09:00:00.000Z",
        id: "field-1",
        name: "Release readiness",
        options: ["Ready", "Later"],
        projectId: "project-1",
        recordTypes: ["Work", "Project Release"],
        revision: 1,
        trashedAt: null,
        type: "Single select",
        updatedAt: "2026-09-19T09:00:00.000Z",
      },
    ]);

    expect(html).toContain("Release readiness");
    expect(html).toContain("Available on: Work, Project Release");
    expect(html).toContain("Options: Ready, Later");
    expect(html).toContain("Edit");
    expect(html).toContain("Move to Trash");
  });

  test("keeps trashed definitions separate with restore and permanent delete", () => {
    const html = renderEditor("project-1", [
      {
        createdAt: "2026-09-19T09:00:00.000Z",
        id: "field-1",
        name: "Release readiness",
        options: [],
        projectId: "project-1",
        recordTypes: ["Work"],
        revision: 2,
        trashedAt: "2026-09-19T10:00:00.000Z",
        type: "Text",
        updatedAt: "2026-09-19T10:00:00.000Z",
      },
    ]);

    expect(html).toContain("Trash");
    expect(html).toContain("Release readiness");
    expect(html).toContain("Restore");
    expect(html).toContain("Permanently Delete");
    expect(html).not.toContain("Move to Trash");
  });
});
