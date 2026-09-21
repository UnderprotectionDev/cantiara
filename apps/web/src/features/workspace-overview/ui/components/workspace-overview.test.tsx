import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { WorkspaceOverviewModel } from "@cantiara/api/workspace-overview";
import { workspaceOverviewSavedListDefinitionSchema } from "@cantiara/api/workspace-overview";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import WorkspaceOverviewView from "./workspace-overview";

const model: WorkspaceOverviewModel = {
  availableLiveBlocks: [
    {
      href: "/documents/document-1",
      id: "document-1",
      source: { recordId: "document-1", recordType: "Document" },
      title: "Checkout notes",
      type: "Document",
    },
    {
      href: "/documents/document-2",
      id: "document-2",
      source: { recordId: "document-2", recordType: "Document" },
      title: "Launch checklist",
      type: "Document",
    },
  ],
  layout: {
    hidden: [],
    order: ["active-projects", "attention-required", "upcoming", "recent-work"],
  },
  liveBlocks: [
    {
      href: "/documents/document-1",
      id: "document-1",
      source: { recordId: "document-1", recordType: "Document" },
      title: "Checkout notes",
      type: "Document",
    },
  ],
  liveBlockSources: [{ recordId: "document-1", recordType: "Document" }],
  modules: [
    {
      id: "active-projects",
      name: "Active Projects",
      records: [
        {
          href: "/projects/project-1",
          id: "project-1",
          projectId: "project-1",
          projectName: "Payment App",
          status: "Active",
          targetDate: "2026-09-30",
          title: "Payment App",
          type: "Project",
        },
      ],
      sourceHref: "/projects?overviewModule=active-projects",
    },
    {
      id: "attention-required",
      name: "Attention Required",
      records: [],
      sourceHref: "/projects?overviewModule=attention-required",
    },
    {
      id: "upcoming",
      name: "Upcoming",
      records: [],
      sourceHref: "/projects?overviewModule=upcoming",
    },
    {
      id: "recent-work",
      name: "Recent Work",
      records: [
        {
          href: "/projects/project-1#work-work-1",
          id: "work-1",
          projectId: "project-1",
          projectName: "Payment App",
          status: "In Progress",
          title: "Add hosted checkout",
          type: "Feature",
          updatedAt: "2026-09-19T08:00:00.000Z",
        },
      ],
      sourceHref: "/projects?overviewModule=recent-work",
    },
  ],
  savedLists: [
    workspaceOverviewSavedListDefinitionSchema.parse({
      columns: ["name", "status", "archive"],
      conditions: { lifecycleStatuses: ["Active"] },
      groupBy: "status",
      id: "active-projects-list",
      name: "Active delivery Projects",
      sort: { direction: "asc", field: "name" },
    }),
  ].map((definition) => ({
    ...definition,
    href: "/projects?savedListId=active-projects-list",
    projects: [
      {
        archivedAt: null,
        createdAt: "2026-09-01T09:00:00.000Z",
        id: "project-1",
        name: "Payment App",
        status: "Active" as const,
        targetDate: "2026-09-30",
        updatedAt: "2026-09-19T08:00:00.000Z",
      },
    ],
  })),
};

describe("Workspace Overview seam", () => {
  test("opens the four source-backed modules and exact source sets", () => {
    const html = renderToStaticMarkup(<WorkspaceOverviewView model={model} />);

    for (const moduleName of [
      "Active Projects",
      "Attention Required",
      "Upcoming",
      "Recent Work",
    ]) {
      expect(html).toContain(moduleName);
      expect(html).toContain(`Open source record: ${moduleName}`);
    }

    expect(html).toContain("Add hosted checkout");
    expect(html).toContain('href="/projects?overviewModule=recent-work"');
    expect(html).toContain('href="/projects/project-1#work-work-1"');
    expect(html).toContain("Open source record");
    expect(html).not.toContain("No Active Projects yet.");
  });

  test("opens only the selected module source set for a drill-down", () => {
    const html = renderToStaticMarkup(
      <WorkspaceOverviewView model={model} selectedModule="recent-work" />,
    );

    expect(html).toContain('data-workspace-overview-source-set="recent-work"');
    expect(html).toContain("Add hosted checkout");
    expect(html).not.toContain("Active Projects");
    expect(html).not.toContain('data-workspace-overview-layout="true"');
  });

  test("exposes presentation controls and keeps live blocks reference-only", () => {
    const html = renderToStaticMarkup(<WorkspaceOverviewView model={model} />);

    expect(html).toContain('data-workspace-overview-layout="true"');
    expect(html).toContain('aria-label="Hide Active Projects"');
    expect(html).toContain('aria-label="Move Recent Work up"');
    expect(html).toContain('aria-label="Move Recent Work down"');
    expect(html).toContain("Choose a source");
    expect(html).toContain('data-live-block-reference="true"');
    expect(html).toContain("Checkout notes");
    expect(html).toContain('href="/documents/document-1"');
    const emptyActiveProjectsHtml = renderToStaticMarkup(
      <WorkspaceOverviewView
        model={{
          ...model,
          modules: model.modules.map((module) =>
            module.id === "active-projects"
              ? { ...module, records: [] }
              : module,
          ),
        }}
      />,
    );

    expect(emptyActiveProjectsHtml).toContain("No Active Projects yet.");
    expect(html).not.toContain("Document body");
    expect(html).not.toContain("membership rule");
    expect(html).not.toContain("Project health");
    expect(html).not.toContain("dashboard");
    expect(html).not.toContain("Wiki");
  });

  test("uses the account date preferences for source metadata", () => {
    const html = renderToStaticMarkup(
      <WorkspaceOverviewView
        formattingPreferences={{
          ...DEFAULT_ACCOUNT_PREFERENCES,
          locale: "en-US",
          timeZone: "America/New_York",
        }}
        model={model}
      />,
    );

    expect(html).toContain("Sep 30, 2026");
  });

  test("shows named live Project lists", () => {
    const html = renderToStaticMarkup(<WorkspaceOverviewView model={model} />);

    expect(html).toContain("Saved lists");
    expect(html).toContain("Active delivery Projects");
    expect(html).toContain("New list");
    expect(html).toContain('href="/projects?savedListId=active-projects-list"');
    expect(html).not.toContain("Portfolio");
    expect(html).not.toContain("Project score");
  });

  test("opens a saved list without exposing manual membership controls", () => {
    const html = renderToStaticMarkup(
      <WorkspaceOverviewView
        model={model}
        selectedSavedList="active-projects-list"
      />,
    );

    expect(html).toContain("Active delivery Projects");
    expect(html).toContain("Archive");
    expect(html).not.toContain("Add Project");
    expect(html).not.toContain("Portfolio");
    expect(html).not.toContain('data-workspace-overview-layout="true"');
  });
});
