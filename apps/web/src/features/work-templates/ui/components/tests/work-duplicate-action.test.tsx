// @vitest-environment happy-dom
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import type { DuplicateWorkPreview } from "@cantiara/api/work-templates";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, test } from "vitest";

import { createClientShell } from "@/features/web-macos-client/store/client-shell";
import { ClientShellProvider } from "@/features/web-macos-client/ui/components/client-shell";
import { orpc } from "@/utils/orpc";
import WorkDuplicateAction from "../work-duplicate-action";

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
  reappearDate: null,
  revision: 1,
  status: "Not Started",
  statusChangedAt: "2026-09-22T09:05:00.000Z",
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
  test("offers a one-off copy preview without living-record payload", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
    });
    queryClient.setQueryData(
      orpc.previewDuplicateWork.queryOptions({
        input: { sourceWorkId: "work-1" },
      }).queryKey,
      preview,
    );

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () =>
        root.render(
          <QueryClientProvider client={queryClient}>
            <ClientShellProvider shell={createClientShell()}>
              <WorkDuplicateAction work={work} />
            </ClientShellProvider>
          </QueryClientProvider>,
        ),
      );
      const trigger = host.querySelector("button");
      expect(trigger?.textContent).toBe("Duplicate Work");
      await act(async () => trigger?.click());
      const previewForm = document.querySelector(
        'form[aria-label="Duplicate Work"]',
      );
      expect(previewForm?.textContent).toContain("Release audience");
      expect(previewForm?.textContent).toContain("Prepare the October release");
      for (const forbidden of [
        "Current status",
        "Closure result",
        "In Progress",
      ]) {
        expect(previewForm?.textContent).not.toContain(forbidden);
      }
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
});
