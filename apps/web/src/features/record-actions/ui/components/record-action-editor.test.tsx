import type { CustomFieldDefinition } from "@cantiara/api/custom-fields";
import type { RecordAction } from "@cantiara/api/record-actions";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { orpc } from "@/utils/orpc";
import RecordActionEditor from "./record-action-editor";

const action: RecordAction = {
  createdAt: "2026-09-22T09:00:00.000Z",
  id: "action-1",
  name: "Start Work",
  projectId: "project-1",
  revision: 1,
  steps: [
    { kind: "work-status", status: "In Progress" },
    { kind: "daily-focus-membership", operation: "add" },
  ],
  trashedAt: null,
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

describe("Record Action editor", () => {
  test("shows the closed one-record catalog and the Start Work definition", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      orpc.recordActions.queryOptions({ input: { projectId: "project-1" } })
        .queryKey,
      [action],
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
        createElement(RecordActionEditor, { projectId: "project-1" }),
      ),
    );

    expect(html).toContain("Record Action");
    expect(html).toContain("Start Work");
    expect(html).toContain("In Progress");
    expect(html).toContain("Daily Focus → Add");
    expect(html).toContain("Release readiness");
    expect(html).toContain("Each Record Action targets one Work record.");
    expect(html).toContain("Move to Trash");
    for (const forbidden of [
      "Bulk Edit",
      "JavaScript",
      "HTTP",
      "GitHub mutation",
      "create-record",
      "Closed",
    ]) {
      expect(html).not.toContain(forbidden);
    }
  });
});
