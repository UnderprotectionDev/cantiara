import type { CaptureInboxSnapshot } from "@cantiara/api/capture-triage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import {
  ClientShellProvider,
  createClientShell,
} from "@/features/web-macos-client/views/client-shell";
import { captureInboxQueryOptions } from "@/utils/orpc";

import { canCreateBug } from "../forms/capture-inbox-form";
import CaptureInboxView from "./capture-inbox-view";

function renderCaptureInbox(
  snapshot: CaptureInboxSnapshot,
  initialConnection: "online" | "offline" = "online",
) {
  const queryClient = new QueryClient();
  const accountId = "account-1";
  queryClient.setQueryData(
    captureInboxQueryOptions(accountId).queryKey,
    snapshot,
  );

  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <ClientShellProvider shell={createClientShell({ initialConnection })}>
        <CaptureInboxView accountId={accountId} />
      </ClientShellProvider>
    </QueryClientProvider>,
  );
}

describe("Capture Inbox view", () => {
  test("shows the empty state and closed mini-template catalog", () => {
    const html = renderCaptureInbox({ groups: [], items: [] });

    expect(html).toContain(">Capture Inbox</h1>");
    expect(html).toContain("Project");
    expect(html).toContain(
      "Leave empty to save to the Workspace Capture Inbox.",
    );
    expect(html).toContain("Bug Capture");
    expect(html).toContain("Feedback Capture");
    expect(html).toContain("Research Fragment");
    expect(html).toContain("No captures in this Inbox.");
    expect(html).toContain(">Save</button>");
  });

  test("renders Workspace and Project Capture Inbox groups without exposing them as search records", () => {
    const html = renderCaptureInbox({
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
    });

    expect(html).toContain("Workspace Capture Inbox");
    expect(html).toContain("Project Capture Inbox");
    expect(html).toContain("Workspace thought");
    expect(html).toContain("Project bug");
    expect(html).not.toContain("Search");
    expect(html).not.toContain("Backlog");
  });

  test("only enables Create Bug for a Project with Bug Capture or no type", () => {
    expect(canCreateBug("project-1", null)).toBe(true);
    expect(canCreateBug("project-1", "Bug Capture")).toBe(true);
    expect(canCreateBug("", "Bug Capture")).toBe(false);
    expect(canCreateBug("project-1", "Feedback Capture")).toBe(false);
    expect(canCreateBug("project-1", "Research Fragment")).toBe(false);
  });

  test("keeps Capture Inbox writes online-only without a local queue", () => {
    const html = renderCaptureInbox({ groups: [], items: [] }, "offline");

    expect(html).toContain("nothing is queued locally.");
    expect(html).toContain('disabled=""');
    expect(html).toContain("Disconnected.");
  });
});
