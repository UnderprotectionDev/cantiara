import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import type { DuplicateWorkPreview } from "@cantiara/api/work-templates";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { createClientShell } from "@/features/web-macos-client/store/client-shell";
import { ClientShellProvider } from "@/features/web-macos-client/ui/components/client-shell";
import { orpc } from "@/utils/orpc";
import WorkDuplicateAction from "./work-duplicate-action";

const work: WorkProfile = {
  archivedAt: null,
  captureProvenance: null,
  checklist: [{ completed: false, id: "check-1", text: "Draft release notes" }],
  closureReason: null,
  closureResult: null,
  createdAt: "2026-09-22T09:05:00.000Z",
  description: "## Outcome",
  effort: null,
  featureHealthHistory: [],
  id: "work-1",
  key: "CAT-1",
  number: 1,
  plannedStartDate: null,
  primaryFeatureId: null,
  primarySpecId: null,
  projectId: "project-1",
  recreatedFrom: null,
  revision: 1,
  status: "Not Started",
  targetDate: null,
  title: "Prepare the October release",
  type: "Task",
  updatedAt: "2026-09-22T09:05:00.000Z",
};

const preview: DuplicateWorkPreview = {
  checklist: [{ id: "check-1", text: "Draft release notes" }],
  customFields: [
    {
      definitionId: "field-1",
      name: "Release audience",
      value: { kind: "text", text: "Founders" },
    },
  ],
  description: "## Outcome",
  sourceRevision: 1,
  sourceWorkId: "work-1",
  title: "Prepare the October release",
  type: "Task",
};

describe("Work duplicate action", () => {
  test("offers a one-off copy preview without living-record payload", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      orpc.previewDuplicateWork.queryOptions({
        input: { sourceWorkId: "work-1" },
      }).queryKey,
      preview,
    );

    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          ClientShellProvider,
          { shell: createClientShell() },
          createElement(WorkDuplicateAction, {
            defaultOpen: true,
            work,
          }),
        ),
      ),
    );

    expect(html).toContain("Duplicate Work");
    expect(html).toContain("Release audience");
    expect(html).toContain("Prepare the October release");
    for (const forbidden of [
      "Current status",
      "Closure result",
      "In Progress",
    ]) {
      expect(html).not.toContain(forbidden);
    }
  });
});
