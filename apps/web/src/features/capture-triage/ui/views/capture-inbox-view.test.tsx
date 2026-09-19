import type { CaptureInboxSnapshot } from "@cantiara/api/capture-triage";
import {
  getProjectShellConfiguration,
  type ProjectProfile,
} from "@cantiara/api/project-shell";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { createClientShell } from "@/features/web-macos-client/store/client-shell";
import { ClientShellProvider } from "@/features/web-macos-client/ui/components/client-shell";
import { captureInboxQueryOptions, projectsQueryOptions } from "@/utils/orpc";

import {
  bulkSenseMakingColumns,
  captureDestination,
} from "../../lib/capture-inbox";
import {
  advanceSequentialTriageAfterExit,
  beginSequentialTriage,
  leaveSequentialTriage,
  moveToNextSequentialTriageItem,
  moveToPreviousSequentialTriageItem,
  restoreSequentialTriageItem,
} from "../../lib/sequential-triage";
import CaptureInboxView from "./capture-inbox-view";

function renderCaptureInbox(
  snapshot: CaptureInboxSnapshot,
  shellOptions: {
    initialConnection?: "online" | "offline";
    initialLastSavedAt?: Date | null;
    initialUnsavedChanges?: boolean;
    initialUpdateRequired?: boolean;
  } = {},
) {
  const queryClient = new QueryClient();
  const accountId = "account-1";
  queryClient.setQueryData(
    captureInboxQueryOptions(accountId).queryKey,
    snapshot,
  );
  const projects = [
    {
      configuration: getProjectShellConfiguration("Blank Project"),
      createdAt: "2026-09-17T09:00:00.000Z",
      id: "project-1",
      logo: null,
      name: "Payment App",
      problem: null,
      purpose: null,
      revision: 1,
      scope: null,
      shortCode: "PAY",
      shortCodeLocked: false,
      starterConfiguration: "Blank Project",
      status: "Active",
      targetDate: null,
      updatedAt: "2026-09-17T09:00:00.000Z",
    },
  ] satisfies ProjectProfile[];
  queryClient.setQueryData(projectsQueryOptions().queryKey, projects);

  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <ClientShellProvider shell={createClientShell(shellOptions)}>
        <CaptureInboxView accountId={accountId} />
      </ClientShellProvider>
    </QueryClientProvider>,
  );
}

describe("Capture Inbox view", () => {
  test("shows the empty state and closed mini-template catalog", () => {
    const html = renderCaptureInbox({
      bulkSenseMaking: { clusters: [], placements: [], revision: 0 },
      groups: [],
      items: [],
      triageAvailable: false,
    });

    expect(html).toContain(">Capture Inbox</h1>");
    expect(html).toContain(">Capture Library</p>");
    expect(html).toContain(">Saved captures</h2>");
    expect(html).toContain("Review temporary captures here.");
    expect(html).toContain(">New capture</button>");
    expect(html).toContain("No captures in this Inbox.");
    expect(html).not.toContain(">Sequential triage</button>");
  });

  test("renders Workspace and Project Capture Inbox groups without exposing them as search records", () => {
    const html = renderCaptureInbox({
      bulkSenseMaking: { clusters: [], placements: [], revision: 0 },
      groups: [
        {
          itemIds: ["capture-1"],
          items: [
            {
              content: "Workspace thought",
              createdAt: "2026-09-16T09:00:00.000Z",
              fields: {},
              id: "capture-1",
              projectId: null,
              template: null,
            },
          ],
          kind: "workspace",
          label: "Workspace Capture Inbox",
        },
        {
          itemIds: ["capture-2"],
          items: [
            {
              content: "Project bug",
              createdAt: "2026-09-16T09:01:00.000Z",
              fields: { "Observed Behavior": "Blank" },
              id: "capture-2",
              projectId: "cantiara",
              template: "Bug Capture",
            },
          ],
          kind: "project",
          label: "Project Capture Inbox",
          projectId: "cantiara",
        },
      ],
      items: [
        {
          content: "Workspace thought",
          createdAt: "2026-09-16T09:00:00.000Z",
          fields: {},
          id: "capture-1",
          projectId: null,
          template: null,
        },
        {
          content: "Project bug",
          createdAt: "2026-09-16T09:01:00.000Z",
          fields: { "Observed Behavior": "Blank" },
          id: "capture-2",
          projectId: "cantiara",
          template: "Bug Capture",
        },
      ],
      triageAvailable: true,
    });

    expect(html).toContain("Workspace Capture Inbox");
    expect(html).toContain("Project Capture Inbox");
    expect(html).toContain("Project inbox");
    expect(html).toContain("1 capture");
    expect(html).toContain('aria-label="Project Capture Inbox"');
    expect(html).toContain("Workspace thought");
    expect(html).toContain("Project bug");
    expect(html).toContain(">Convert</button>");
    expect(html).toContain(">Attach to existing</button>");
    expect(html).toContain(">Delete</button>");
    expect(html).toContain(">Show suggestions</button>");
    expect(html).toContain(">Bulk sense-making</button>");
    expect(html).not.toContain("Search");
    expect(html).not.toContain("Backlog");
  });

  test("offers Sequential triage when Capture Inbox exits are available", () => {
    const html = renderCaptureInbox({
      bulkSenseMaking: { clusters: [], placements: [], revision: 0 },
      groups: [
        {
          itemIds: ["capture-1"],
          items: [
            {
              content: "Focus this capture",
              createdAt: "2026-09-16T09:00:00.000Z",
              fields: {},
              id: "capture-1",
              projectId: null,
              template: null,
            },
          ],
          kind: "workspace",
          label: "Workspace Capture Inbox",
        },
      ],
      items: [
        {
          content: "Focus this capture",
          createdAt: "2026-09-16T09:00:00.000Z",
          fields: {},
          id: "capture-1",
          projectId: null,
          template: null,
        },
      ],
      triageAvailable: true,
    });

    expect(html).toContain(">Sequential triage</button>");
  });

  test("shows where a capture will be saved", () => {
    expect(captureDestination("")).toEqual({
      detail:
        "This capture will appear here until you choose what happens next.",
      label: "Workspace Capture Inbox",
    });
    expect(
      captureDestination("  project-1  ", [
        { id: "project-1", name: "Payment App", shortCode: "PAY" },
      ]),
    ).toEqual({
      detail: "This capture will appear under Payment App (PAY).",
      label: "Project Capture Inbox",
    });
  });

  test("opens capture creation from the library without exposing an internal id", () => {
    const html = renderCaptureInbox({
      bulkSenseMaking: { clusters: [], placements: [], revision: 0 },
      groups: [],
      items: [],
      triageAvailable: false,
    });

    expect(html).toContain(">New capture</button>");
    expect(html).not.toContain("project-1");
    expect(html).not.toContain('placeholder="Leave empty for Workspace"');
  });

  test("keeps named Bulk sense-making columns beside Ungrouped", () => {
    const items = [
      {
        content: "Clustered thought",
        createdAt: "2026-09-16T09:00:00.000Z",
        fields: {},
        id: "capture-clustered",
        projectId: null,
        template: null,
      },
      {
        content: "Unassigned thought",
        createdAt: "2026-09-16T09:01:00.000Z",
        fields: {},
        id: "capture-ungrouped",
        projectId: null,
        template: null,
      },
    ] as const;

    expect(
      bulkSenseMakingColumns(items, {
        clusters: [{ id: "cluster-1", name: "Ideas", position: 0 }],
        placements: [
          { clusterId: "cluster-1", itemId: "capture-clustered", position: 0 },
          { clusterId: null, itemId: "capture-ungrouped", position: 0 },
        ],
        revision: 1,
      }).map((column) => ({
        items: column.items.map((item) => item.id),
        label: column.label,
      })),
    ).toEqual([
      { items: ["capture-ungrouped"], label: "Ungrouped" },
      { items: ["capture-clustered"], label: "Ideas" },
    ]);
  });

  test("keeps Capture Inbox writes online-only without a local queue", () => {
    const html = renderCaptureInbox(
      {
        bulkSenseMaking: { clusters: [], placements: [], revision: 0 },
        groups: [],
        items: [],
        triageAvailable: false,
      },
      {
        initialConnection: "offline",
        initialLastSavedAt: new Date("2026-09-16T09:00:00.000Z"),
        initialUnsavedChanges: true,
      },
    );

    expect(html).toContain("You’re offline");
    expect(html).toContain("Last saved");
    expect(html).toContain("16 Sept 2026, 12:00");
    expect(html).toContain("Unsaved changes may be lost");
    expect(html).not.toContain("Disconnected.");
  });

  test("shows the desktop update boundary while keeping the Capture Inbox visible", () => {
    const html = renderCaptureInbox(
      {
        bulkSenseMaking: { clusters: [], placements: [], revision: 0 },
        groups: [],
        items: [],
        triageAvailable: false,
      },
      { initialUpdateRequired: true },
    );

    expect(html).toContain("Update required");
    expect(html).toContain(
      "This desktop version must be updated before you can save changes.",
    );
    expect(html).toContain("New capture");
  });
});

describe("Sequential triage focus", () => {
  test("advances only through an explicit exit and supports the previous item", () => {
    const started = beginSequentialTriage(["capture-1", "capture-2"]);

    expect(started).toMatchObject({ mode: "focused", itemId: "capture-1" });
    expect(moveToNextSequentialTriageItem(started)).toEqual(started);
    expect(moveToPreviousSequentialTriageItem(started)).toEqual(started);

    const next = advanceSequentialTriageAfterExit(started);
    expect(next).toMatchObject({
      itemId: "capture-2",
      itemIndex: 1,
      mode: "focused",
      resolvedItemIds: ["capture-1"],
    });
    const previous = moveToPreviousSequentialTriageItem(next);
    expect(previous).toMatchObject({
      itemId: "capture-1",
      itemIndex: 0,
      mode: "focused",
    });
    expect(moveToNextSequentialTriageItem(previous)).toEqual(next);
    expect(moveToNextSequentialTriageItem(next)).toEqual(next);
  });

  test("returns to the list explicitly and completes after the last exit", () => {
    const started = beginSequentialTriage(["capture-1"]);
    const complete = advanceSequentialTriageAfterExit(started);

    expect(complete).toMatchObject({
      itemIds: ["capture-1"],
      mode: "complete",
      resolvedItemIds: ["capture-1"],
    });
    expect(leaveSequentialTriage()).toEqual({ mode: "list" });
  });

  test("restores an undone item to focus, including after the session completed", () => {
    const started = beginSequentialTriage(["capture-1", "capture-2"]);
    const next = advanceSequentialTriageAfterExit(started);
    const complete = advanceSequentialTriageAfterExit(next);

    expect(restoreSequentialTriageItem(next, "capture-1")).toMatchObject({
      itemId: "capture-2",
      mode: "focused",
      resolvedItemIds: [],
    });
    expect(restoreSequentialTriageItem(complete, "capture-2")).toMatchObject({
      itemId: "capture-2",
      itemIndex: 1,
      mode: "focused",
      resolvedItemIds: ["capture-1"],
    });
  });
});
