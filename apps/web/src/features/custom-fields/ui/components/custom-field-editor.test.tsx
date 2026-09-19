import {
  CUSTOM_FIELD_RECORD_TYPE_OPTIONS,
  CUSTOM_FIELD_TYPE_OPTIONS,
} from "@cantiara/api/custom-fields";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { orpc } from "@/utils/orpc";
import CustomFieldEditor from "./custom-field-editor";

describe("Custom field editor", () => {
  test("renders the closed type and record binding catalogs without forbidden counterparts", () => {
    const queryClient = new QueryClient();
    const projectId = "project-1";
    queryClient.setQueryData(
      orpc.customFields.queryOptions({ input: { projectId } }).queryKey,
      [],
    );

    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(CustomFieldEditor, { projectId }),
      ),
    );

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
    const queryClient = new QueryClient();
    const projectId = "project-1";
    queryClient.setQueryData(
      orpc.customFields.queryOptions({ input: { projectId } }).queryKey,
      [
        {
          createdAt: "2026-09-19T09:00:00.000Z",
          id: "field-1",
          name: "Release readiness",
          options: ["Ready", "Later"],
          projectId,
          recordTypes: ["Work", "Project Release"],
          revision: 1,
          type: "Single select",
          updatedAt: "2026-09-19T09:00:00.000Z",
        },
      ],
    );

    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(CustomFieldEditor, { projectId }),
      ),
    );

    expect(html).toContain("Release readiness");
    expect(html).toContain("Available on: Work, Project Release");
    expect(html).toContain("Options: Ready, Later");
  });
});
