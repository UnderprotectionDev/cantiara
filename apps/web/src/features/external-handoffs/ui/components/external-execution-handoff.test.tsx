import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { createClientShell } from "@/features/web-macos-client/store/client-shell";
import { ClientShellProvider } from "@/features/web-macos-client/ui/components/client-shell";
import { orpc } from "@/utils/orpc";
import ExternalExecutionHandoff from "./external-execution-handoff";

const work: WorkProfile = {
  archivedAt: null,
  captureProvenance: null,
  checklist: [],
  closureReason: null,
  closureResult: null,
  createdAt: "2026-09-22T09:05:00.000Z",
  description: "## Outcome\nKeep the selected context frozen.",
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
  revision: 3,
  status: "In Progress",
  targetDate: null,
  title: "Prepare the October release",
  type: "Task",
  updatedAt: "2026-09-22T09:05:00.000Z",
};

describe("External Execution Handoff", () => {
  test("shows the selected frozen package and Work revision on its Work", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      orpc.externalExecutionHandoffs.queryOptions({
        input: { workId: work.id },
      }).queryKey,
      [
        {
          constraints: "Do not change the release scope.",
          createdAt: "2026-09-22T10:00:00.000Z",
          executor: "Build agent",
          expectedOutput: "A reviewed implementation.",
          githubContext: ["https://github.com/acme/release/issues/12"],
          handoffId: "handoff-1",
          includeWork: true,
          packageMarkdown:
            "# External Execution Handoff\nWork: CAT-1\nrevision 3\nhttps://github.com/acme/release/issues/12\nSource of truth is in the app\n",
          packageProducedAt: "2026-09-22T10:00:00.000Z",
          purpose: "Prepare release changes",
          selectedWorkRevision: 3,
          status: "Open",
          workId: work.id,
        },
      ],
    );

    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          ClientShellProvider,
          { shell: createClientShell() },
          createElement(ExternalExecutionHandoff, {
            defaultExpanded: true,
            work,
          }),
        ),
      ),
    );

    for (const expected of [
      "External Execution Handoff",
      "Start Handoff",
      "Purpose",
      "Expected output",
      "Executor",
      "Constraints",
      "Selected versions",
      "Include this Work · revision 3",
      "GitHub context",
      "https://github.com/acme/release/issues/12",
      "Prepare release changes",
      "CAT-1 · revision 3",
      "Copy going package",
      "Source of truth is in the app",
    ]) {
      expect(html).toContain(expected);
    }
    expect(html).not.toContain("secret");
  });
});
