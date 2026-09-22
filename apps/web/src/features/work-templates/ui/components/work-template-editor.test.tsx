import type { CustomFieldDefinition } from "@cantiara/api/custom-fields";
import type { WorkTemplate } from "@cantiara/api/work-templates";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { orpc } from "@/utils/orpc";
import WorkTemplateEditor from "./work-template-editor";

const template: WorkTemplate = {
  checklist: [{ id: "check-1", text: "Draft release notes" }],
  createdAt: "2026-09-22T09:00:00.000Z",
  customFieldDefaults: [
    {
      definitionId: "field-1",
      value: { kind: "option", option: "Ready" },
    },
  ],
  descriptionSkeleton: "## Outcome",
  id: "template-1",
  name: "Release preparation",
  projectId: "project-1",
  relativeDates: {
    plannedStart: { offsetDays: 2 },
    target: { offsetDays: 10 },
  },
  revision: 1,
  trashedAt: null,
  type: "Task",
  updatedAt: "2026-09-22T09:00:00.000Z",
};

const field: CustomFieldDefinition = {
  createdAt: "2026-09-20T09:00:00.000Z",
  id: "field-1",
  name: "Release readiness",
  options: ["Ready", "Later"],
  projectId: "project-1",
  recordTypes: ["Work"],
  revision: 1,
  trashedAt: null,
  type: "Single select",
  updatedAt: "2026-09-20T09:00:00.000Z",
};

describe("Work Template editor", () => {
  test("shows reusable start context and resolved date previews without forbidden payload controls", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      orpc.workTemplates.queryOptions({ input: { projectId: "project-1" } })
        .queryKey,
      [template],
    );
    queryClient.setQueryData(
      orpc.customFields.queryOptions({ input: { projectId: "project-1" } })
        .queryKey,
      [field],
    );

    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(WorkTemplateEditor, {
          previewDate: "2026-09-22",
          projectId: "project-1",
        }),
      ),
    );

    expect(html).toContain("Work Template");
    expect(html).toContain("Release preparation");
    expect(html).toContain("Release readiness");
    expect(html).toContain("2026-09-24");
    expect(html).toContain("2026-10-02");
    expect(html).toContain("Move to Trash");
    for (const forbidden of [
      "Current status",
      "Closure result",
      "Relations",
      "History",
      "Absolute date",
      "Document Template",
      "Capture mini-template",
    ]) {
      expect(html).not.toContain(forbidden);
    }
  });
});
