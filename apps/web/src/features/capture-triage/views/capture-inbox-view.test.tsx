import type { CaptureInboxSnapshot } from "@cantiara/api/capture-triage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import {
  ClientShellProvider,
  createClientShell,
} from "@/features/web-macos-client/views/client-shell";
import { captureInboxQueryOptions } from "@/utils/orpc";

import {
  CREATE_BUG_UNAVAILABLE_MESSAGE,
  captureDestination,
} from "../forms/capture-inbox-form";
import CaptureInboxView, { bulkSenseMakingColumns } from "./capture-inbox-view";

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
    expect(html).toContain("Project");
    expect(html).toContain(
      "Leave empty to save to the Workspace Capture Inbox.",
    );
    expect(html).toContain("Destination");
    expect(html).toContain(
      "This capture will appear here until you choose what happens next.",
    );
    expect(html).toContain("Bug Capture");
    expect(html).toContain("Feedback Capture");
    expect(html).toContain("Research Fragment");
    expect(html).toContain(">Saved captures</h2>");
    expect(html).toContain(
      "Capture Inbox groups are shown here after you save.",
    );
    expect(html).toContain("No captures in this Inbox.");
    expect(html).toContain(">Save</button>");
    expect(html).toContain(">Create Bug</button>");
    expect(html).toContain(CREATE_BUG_UNAVAILABLE_MESSAGE);
    expect(html).toContain('disabled=""');
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

  test("shows where a capture will be saved", () => {
    expect(captureDestination("")).toEqual({
      detail:
        "This capture will appear here until you choose what happens next.",
      label: "Workspace Capture Inbox",
    });
    expect(captureDestination("  project-1  ")).toEqual({
      detail: "This capture will appear under project-1.",
      label: "Project Capture Inbox",
    });
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

    expect(html).toContain("nothing is queued locally.");
    expect(html).toContain('disabled=""');
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
