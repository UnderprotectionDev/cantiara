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
          cancellationReason: null,
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
    queryClient.setQueryData(
      orpc.externalExecutionHandoffHistory.queryOptions({
        input: { workId: work.id },
      }).queryKey,
      [
        {
          actorId: "account-1",
          eventId: "event-started",
          eventType: "external-execution-handoff-started",
          handoffId: "handoff-1",
          occurredAt: "2026-09-22T10:00:00.000Z",
        },
        {
          actorId: "account-1",
          eventId: "event-produced",
          eventType: "external-execution-handoff-package-produced",
          handoffId: "handoff-1",
          occurredAt: "2026-09-22T10:00:00.000Z",
        },
        {
          actorId: "account-1",
          eventId: "event-copied",
          eventType: "external-execution-handoff-package-exported",
          handoffId: "handoff-1",
          occurredAt: "2026-09-22T10:01:00.000Z",
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
      "Free text is copied as entered and is not scanned for secrets.",
      "Review the package before sharing.",
      "Source of truth is in the app",
      "Handoff history",
      "Handoff started",
      "Going package produced",
      "Going package copied",
      "You",
    ]) {
      expect(html).toContain(expected);
    }
    expect(html.match(/by You/g)).toHaveLength(3);
    expect(html.indexOf("Review the package before sharing.")).toBeLessThan(
      html.indexOf("Copy going package"),
    );
    expect(html).not.toContain("secret_token");
  });

  test("keeps frozen handoffs readable from archived Work without a start form", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      orpc.externalExecutionHandoffs.queryOptions({
        input: { workId: work.id },
      }).queryKey,
      [
        {
          cancellationReason: null,
          constraints: "Do not change the release scope.",
          createdAt: "2026-09-22T10:00:00.000Z",
          executor: "Build agent",
          expectedOutput: "A reviewed implementation.",
          githubContext: [],
          handoffId: "handoff-archived",
          includeWork: true,
          packageMarkdown: "# External Execution Handoff\nFrozen package",
          packageProducedAt: "2026-09-22T10:00:00.000Z",
          purpose: "Prepare release changes",
          selectedWorkRevision: 3,
          status: "Open",
          workId: work.id,
        },
      ],
    );
    queryClient.setQueryData(
      orpc.externalExecutionHandoffHistory.queryOptions({
        input: { workId: work.id },
      }).queryKey,
      [
        {
          actorId: "account-1",
          eventId: "event-started",
          eventType: "external-execution-handoff-started",
          handoffId: "handoff-archived",
          occurredAt: "2026-09-22T10:00:00.000Z",
        },
        {
          actorId: "account-1",
          eventId: "event-copied",
          eventType: "external-execution-handoff-package-exported",
          handoffId: "handoff-archived",
          occurredAt: "2026-09-22T10:01:00.000Z",
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
            work: { ...work, archivedAt: "2026-09-23T12:00:00.000Z" },
          }),
        ),
      ),
    );

    expect(html).toContain("View Handoffs");
    expect(html).toContain("Frozen package");
    expect(html).toContain("Handoff history");
    expect(html).toContain("Handoff started");
    expect(html).toContain("Going package copied");
    expect(html).toContain('aria-label="Start Handoff"');
    expect(html).toContain('hidden=""');
    expect(html).not.toContain('aria-label="Cancel Handoff"');
  });

  test("offers reasoned cancellation while a returned handoff remains open", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      orpc.externalExecutionHandoffs.queryOptions({
        input: { workId: work.id },
      }).queryKey,
      [
        {
          cancellationReason: null,
          constraints: "Keep the project history.",
          createdAt: "2026-09-23T11:00:00.000Z",
          executor: "Local coding agent",
          expectedOutput: "A reviewed implementation.",
          githubContext: ["https://github.com/acme/release/pull/42"],
          handoffId: "handoff-returned",
          includeWork: true,
          packageMarkdown: "# External Execution Handoff\nFrozen package",
          packageProducedAt: "2026-09-23T11:00:00.000Z",
          purpose: "Make a coding pass",
          selectedWorkRevision: 3,
          status: "Result returned",
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

    expect(html).toContain("Result returned");
    expect(html).toContain('aria-label="Cancel Handoff"');
    expect(html).toContain("Reason");
    expect(html).toContain('required=""');
    expect(html).toContain("Cancel Handoff");
    expect(html).toContain("Frozen package");
    expect(html).not.toContain("Test Handoff");
    expect(html).not.toContain("Test Session");
    expect(html).not.toContain("Dış Araca Kaçış");
  });

  test("keeps a canceled handoff and its reason without reopening it", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      orpc.externalExecutionHandoffs.queryOptions({
        input: { workId: work.id },
      }).queryKey,
      [
        {
          cancellationReason: "The selected approach changed.",
          constraints: "Keep the project history.",
          createdAt: "2026-09-23T11:00:00.000Z",
          executor: "Local coding agent",
          expectedOutput: "A reviewed implementation.",
          githubContext: [],
          handoffId: "handoff-canceled",
          includeWork: true,
          packageMarkdown: "# External Execution Handoff\nFrozen package",
          packageProducedAt: "2026-09-23T11:00:00.000Z",
          purpose: "Make a coding pass",
          selectedWorkRevision: 3,
          status: "Canceled",
          workId: work.id,
        },
      ],
    );
    queryClient.setQueryData(
      orpc.externalExecutionHandoffHistory.queryOptions({
        input: { workId: work.id },
      }).queryKey,
      [
        {
          actorId: "account-1",
          eventId: "event-canceled",
          eventType: "external-execution-handoff-canceled",
          handoffId: "handoff-canceled",
          occurredAt: "2026-09-23T11:01:00.000Z",
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

    expect(html).toContain("Canceled");
    expect(html).toContain("Canceled by You");
    expect(html).toContain("Reason");
    expect(html).toContain("The selected approach changed.");
    expect(html).toContain("Frozen package");
    expect(html).not.toContain('aria-label="Cancel Handoff"');
  });
});
