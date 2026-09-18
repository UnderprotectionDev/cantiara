import type { ProjectOverviewSources } from "@cantiara/api/project-overview";
import {
  getProjectShellConfiguration,
  type ProjectProfile,
} from "@cantiara/api/project-shell";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import ProjectOverviewView from "./project-overview-view";

const PROJECT_TARGET_DATE_PATTERN = /30 Sept? 2026/;
const RECENT_CHANGE_DATE_PATTERN = /Sep 18, 2026(?: at|,) 4:00 AM/;

const project: ProjectProfile = {
  configuration: {
    ...getProjectShellConfiguration("Blank Project"),
    enabledAreas: ["Work", "Documents", "Tests"],
    hiddenAreas: ["Documents"],
    preparedStages: [
      { id: "build", name: "Build", status: "Active" },
      { id: "release", name: "Release", status: "Not Planned" },
    ],
  },
  createdAt: "2026-09-17T09:00:00.000Z",
  id: "project-1",
  logo: null,
  name: "Payment App",
  problem: null,
  purpose: "Help small teams collect payments without a spreadsheet.",
  revision: 1,
  scope: null,
  shortCode: "PAY",
  shortCodeLocked: false,
  starterConfiguration: "Blank Project",
  status: "Active",
  targetDate: "2026-09-30",
  updatedAt: "2026-09-17T09:00:00.000Z",
};

const sources: ProjectOverviewSources = {
  activeTestHandoffs: [
    { id: "handoff-1", title: "Checkout handoff", type: "Test Handoff" },
  ],
  blockers: [{ id: "blocker-1", title: "Waiting on provider access" }],
  decisions: [{ id: "decision-1", title: "Use hosted checkout" }],
  dates: [
    {
      id: "milestone-date-1",
      targetDate: "2026-09-25",
      title: "Private beta",
    },
  ],
  documents: [{ id: "document-1", title: "Checkout notes" }],
  goals: [
    {
      href: "/projects/project-1/goals/goal-1",
      id: "goal-1",
      title: "Reach first ten customers",
    },
  ],
  importantProductionIncidents: [{ id: "incident-1", title: "Webhook delay" }],
  milestones: [{ id: "milestone-1", title: "Private beta" }],
  openTestGaps: [{ id: "gap-1", title: "Retry path is unverified" }],
  recentChanges: [
    {
      id: "change-1",
      title: "Checkout notes updated",
      updatedAt: "2026-09-18T08:00:00.000Z",
    },
  ],
  recentTestSessions: [{ id: "session-1", title: "Founder checkout session" }],
  risks: [{ id: "risk-1", title: "Provider approval may slip" }],
  work: [{ id: "work-1", title: "Add hosted checkout" }],
};

function renderOverview(
  overrides: Partial<ProjectProfile> = {},
  overviewSources: ProjectOverviewSources = sources,
) {
  return renderToStaticMarkup(
    <ProjectOverviewView
      accountFormattingPreferences={{
        locale: "en-GB",
        timeZone: "Europe/Istanbul",
      }}
      project={{ ...project, ...overrides }}
      sources={overviewSources}
    />,
  );
}

describe("Project Overview", () => {
  test("summarizes source records in the named neutral modules", () => {
    const html = renderOverview();

    for (const moduleName of [
      "Purpose",
      "Lifecycle",
      "Goals",
      "Stages",
      "Milestones",
      "Work",
      "Documents",
      "Decisions",
      "Risks",
      "Tests",
      "Production",
      "Blockers",
      "Dates",
      "Recent changes",
    ]) {
      expect(html).toContain(moduleName);
    }

    expect(html).toContain(
      "Help small teams collect payments without a spreadsheet.",
    );
    expect(html).toContain("Build");
    expect(html).toContain("Reach first ten customers");
    expect(html).toContain("Checkout notes updated");
    expect(html).toContain("Checkout handoff");
    expect(html).toContain("Founder checkout session");
    expect(html).toContain("Retry path is unverified");
    expect(html).toContain('href="/projects/project-1/goals/goal-1"');
    expect(html).toContain("Open source record");
    expect(html).toMatch(PROJECT_TARGET_DATE_PATTERN);
    expect(html).toContain('data-overview-area="Work"');
    expect(html).toContain('data-overview-area="Tests"');
    expect(html).toContain('data-overview-stage="build"');
    expect(html).not.toContain('data-overview-area="Documents"');
    expect(html).not.toContain('data-overview-stage="release"');
  });

  test("keeps missing source domains empty and excludes dashboard language", () => {
    const html = renderOverview(
      {
        configuration: {
          ...project.configuration,
          enabledAreas: ["Work", "Documents"],
          hiddenAreas: [],
          preparedStages: [],
        },
        purpose: null,
        targetDate: null,
      },
      {},
    );

    expect(html).toContain("No source records yet.");
    expect(html).toContain("No Purpose recorded yet.");
    expect(html).not.toContain("Reach first ten customers");
    expect(html).not.toContain("Project health");
    expect(html).not.toContain("traffic-light");
    expect(html).not.toContain("Workspace overview");
    expect(html).not.toContain("Value Chain");
    expect(html).not.toContain("Manual Project Update");
    expect(html).not.toContain("Open Question");
    expect(html).not.toContain("score");
  });

  test("uses Account locale and time zone for source dates", () => {
    const html = renderToStaticMarkup(
      <ProjectOverviewView
        accountFormattingPreferences={{
          locale: "en-US",
          timeZone: "America/New_York",
        }}
        project={project}
        sources={sources}
      />,
    );

    expect(html).toContain("Sep 30, 2026");
    expect(html).toMatch(RECENT_CHANGE_DATE_PATTERN);
  });
});
