import { describe, expect, test } from "vitest";

import {
  buildWorkspaceOverview,
  moveWorkspaceOverviewModule,
  normalizeWorkspaceOverviewLayout,
  setWorkspaceOverviewModuleVisibility,
  WORKSPACE_OVERVIEW_MODULE_IDS,
  WORKSPACE_OVERVIEW_RECENT_WORK_LIMIT,
  workspaceOverviewLiveBlockSourceSchema,
} from "./workspace-overview";

describe("Workspace Overview seam", () => {
  test("derives the four prepared modules from source records", () => {
    const overview = buildWorkspaceOverview({
      projects: [
        {
          createdAt: "2026-09-01T09:00:00.000Z",
          id: "project-active",
          name: "Payment App",
          status: "Active",
          targetDate: "2026-09-30",
          updatedAt: "2026-09-18T09:00:00.000Z",
        },
        {
          createdAt: "2026-09-02T09:00:00.000Z",
          id: "project-pending",
          name: "Archive Tool",
          status: "Pending",
          targetDate: null,
          updatedAt: "2026-09-17T09:00:00.000Z",
        },
      ],
      works: [
        {
          archivedAt: null,
          id: "work-recent",
          key: "PAY-1",
          projectId: "project-active",
          status: "In Progress",
          title: "Add hosted checkout",
          type: "Feature",
          updatedAt: "2026-09-19T09:00:00.000Z",
        },
        {
          archivedAt: null,
          id: "work-blocked",
          key: "PAY-2",
          projectId: "project-active",
          status: "Blocked",
          title: "Waiting on provider access",
          type: "Task",
          updatedAt: "2026-09-18T09:00:00.000Z",
        },
      ],
      attention: [
        {
          id: "risk-1",
          href: "/projects/project-active#risks",
          title: "Provider approval may slip",
          type: "Risk",
        },
      ],
    });

    expect(overview.modules.map((module) => module.id)).toEqual(
      WORKSPACE_OVERVIEW_MODULE_IDS,
    );
    expect(overview.modules[0]?.records.map((record) => record.id)).toEqual([
      "project-active",
    ]);
    expect(overview.modules[1]?.records.map((record) => record.id)).toEqual([
      "risk-1",
      "work-blocked",
    ]);
    expect(overview.modules[2]?.records.map((record) => record.id)).toEqual([
      "project-active",
    ]);
    expect(overview.modules[3]?.records.map((record) => record.id)).toEqual([
      "work-recent",
      "work-blocked",
    ]);
    expect(overview.modules[0]?.sourceHref).toBe(
      "/projects?overviewModule=active-projects",
    );
    expect(overview.modules[3]?.records[0]).toMatchObject({
      href: "/projects/project-active#work-work-recent",
      projectName: "Payment App",
      type: "Feature",
    });
  });

  test("keeps layout presentation separate from source records and live block content", () => {
    const layout = normalizeWorkspaceOverviewLayout({
      hidden: ["upcoming", "upcoming"],
      order: ["recent-work", "active-projects", "recent-work"],
    });
    const moved = moveWorkspaceOverviewModule(
      layout,
      "active-projects",
      "down",
    );
    const visible = setWorkspaceOverviewModuleVisibility(
      moved,
      "upcoming",
      true,
    );
    const overview = buildWorkspaceOverview({
      availableLiveBlocks: [
        {
          href: "/documents/doc-1",
          id: "live-document-1",
          source: { recordId: "doc-1", recordType: "Document" },
          title: "Checkout notes",
          type: "Document",
        },
      ],
      liveBlockSources: [{ recordId: "doc-1", recordType: "Document" }],
      projects: [],
    });

    expect(layout).toEqual({
      hidden: ["upcoming"],
      order: [
        "recent-work",
        "active-projects",
        "attention-required",
        "upcoming",
      ],
    });
    expect(moved.order).toEqual([
      "recent-work",
      "attention-required",
      "active-projects",
      "upcoming",
    ]);
    expect(visible.hidden).toEqual([]);
    expect(overview.liveBlocks[0]).toEqual({
      href: "/documents/doc-1",
      id: "live-document-1",
      source: { recordId: "doc-1", recordType: "Document" },
      title: "Checkout notes",
      type: "Document",
    });
    expect(overview.liveBlocks[0]).not.toHaveProperty("body");
    expect(overview.liveBlocks[0]).not.toHaveProperty("membershipRule");
  });

  test("keeps past dates out of Upcoming while retaining future dated sources", () => {
    const overview = buildWorkspaceOverview({
      asOf: "2026-09-21",
      projects: [
        {
          createdAt: "2026-09-01T09:00:00.000Z",
          id: "project-past",
          name: "Past target",
          status: "Active",
          targetDate: "2026-09-20",
          updatedAt: "2026-09-18T09:00:00.000Z",
        },
        {
          createdAt: "2026-09-02T09:00:00.000Z",
          id: "project-future",
          name: "Future target",
          status: "Active",
          targetDate: "2026-09-30",
          updatedAt: "2026-09-18T09:00:00.000Z",
        },
      ],
      upcoming: [
        {
          href: "/reminders/past",
          id: "reminder-past",
          targetDate: "2026-09-19",
          title: "Past reminder",
          type: "Reminder",
        },
        {
          href: "/reminders/future",
          id: "reminder-future",
          targetDate: "2026-09-22",
          title: "Future reminder",
          type: "Reminder",
        },
      ],
    });

    expect(overview.modules[2]?.records.map((record) => record.id)).toEqual([
      "reminder-future",
      "project-future",
    ]);
  });

  test("bounds Recent Work to the configured limit and keeps the latest records", () => {
    const limit = WORKSPACE_OVERVIEW_RECENT_WORK_LIMIT;
    const overview = buildWorkspaceOverview({
      projects: [],
      works: Array.from({ length: limit + 5 }, (_, index) => ({
        archivedAt: null,
        id: `work-${index}`,
        key: `PAY-${index}`,
        projectId: "project-active",
        status: "In Progress" as const,
        title: `Work ${index}`,
        type: "Task" as const,
        updatedAt: new Date(Date.UTC(2026, 8, 1 + index, 9)).toISOString(),
      })),
    });
    const [, , , recentWork] = overview.modules;

    expect(recentWork?.id).toBe("recent-work");
    expect(recentWork?.records).toHaveLength(limit);
    expect(recentWork?.records[0]?.id).toBe(`work-${limit + 4}`);
  });

  test("requires a named view for Smart Collection live blocks", () => {
    expect(
      workspaceOverviewLiveBlockSourceSchema.safeParse({
        recordId: "collection-1",
        recordType: "Smart Collection",
      }).success,
    ).toBe(false);
    expect(
      workspaceOverviewLiveBlockSourceSchema.safeParse({
        recordId: "collection-1",
        recordType: "Smart Collection",
        viewId: "view-1",
      }).success,
    ).toBe(true);
  });
});
