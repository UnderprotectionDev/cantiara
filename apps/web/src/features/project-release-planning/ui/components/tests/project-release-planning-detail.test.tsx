import type { ProjectReleasePlanningDetail as Detail } from "@cantiara/api/project-release-planning";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import {
  type ProjectReleasePlanningActions,
  ProjectReleasePlanningDetail,
} from "../project-release-planning-detail";

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a {...props} href={href} />
  ),
}));

const noop = async () => undefined;
const actions: ProjectReleasePlanningActions = {
  onAddAudience: noop,
  onAddLink: noop,
  onAddScope: noop,
  onRemoveAudience: noop,
  onRemoveLink: noop,
  onRemoveScope: noop,
  onSaveHypothesis: noop,
};

function work(id: string, status: string, closureResult: string | null = null) {
  return {
    closureResult,
    id,
    key: id.toUpperCase(),
    status,
    title: `Work ${id}`,
    type: "Task",
    unavailable: false,
  };
}

const detail: Detail = {
  audience: [
    {
      attached: true,
      id: "audience-1",
      revision: 1,
      target: { id: "contact-1", title: "Early adopter", type: "Contact" },
    },
  ],
  audienceCandidates: [
    { id: "persona-1", title: "Solo founder", type: "Persona" },
  ],
  links: [
    {
      attached: true,
      id: "link-1",
      kind: "Release",
      label: "v1.1.0",
      repository: { id: "repository-1", name: "tidekit", owner: "acme" },
      revision: 1,
      url: "https://github.com/acme/tidekit/releases/tag/v1.1.0",
    },
  ],
  readOnly: false,
  release: {
    accessEvidence: null,
    audience: "Solo founders",
    createdAt: "2026-10-20T10:00:00.000Z",
    description: "Sync and docs",
    id: "release-1",
    intendedOutcome: "Founders return to paused work",
    name: "tidekit 1.1",
    outcomeEvidence: null,
    primaryAccessPath: null,
    projectId: "project-1",
    revision: 3,
    sourceType: "Project Release",
    status: "Preparing",
    updatedAt: "2026-10-20T10:00:00.000Z",
    versionLabel: "v1.1.0",
  },
  repositories: [{ id: "repository-1", name: "tidekit", owner: "acme" }],
  scope: [
    {
      attached: true,
      id: "s-1",
      revision: 1,
      work: work("tk-1", "In Progress"),
    },
    {
      attached: true,
      id: "s-2",
      revision: 1,
      work: work("tk-2", "Closed", "Completed"),
    },
    { attached: false, id: "s-3", revision: 2, work: work("tk-3", "Blocked") },
  ],
  scopeCandidates: [work("tk-3", "Blocked")],
};

describe("Project Release Planning detail", () => {
  test("shows the record type, Version label, status and the Planning view", () => {
    const html = renderToStaticMarkup(
      <ProjectReleasePlanningDetail
        actions={actions}
        detail={detail}
        projectId="project-1"
      />,
    );
    for (const text of [
      "Project Release",
      "tidekit 1.1",
      "Version label",
      "Preparing",
      "Planning",
    ]) {
      expect(html).toContain(text);
    }
    for (const text of ["Milestone", "Focus Period", "Release Evidence Pack"]) {
      expect(html).not.toContain(text);
    }
  });

  test("groups attached scope by the Work's own status and offers explicit add and remove", () => {
    const html = renderToStaticMarkup(
      <ProjectReleasePlanningDetail
        actions={actions}
        detail={detail}
        projectId="project-1"
      />,
    );
    expect(html).toContain("1 completed, 1 open");
    expect(html).toContain('aria-label="Open"');
    expect(html).toContain('aria-label="Completed"');
    expect(html).toContain("TK-1 · Work tk-1");
    expect(html).toContain("Add Work to scope");
    expect(html.match(/Remove from scope/g)).toHaveLength(2);
    expect(html).toContain("TK-3 · Work tk-3");
  });

  test("keeps the five hypothesis fields separate, optional and not a gate", () => {
    const html = renderToStaticMarkup(
      <ProjectReleasePlanningDetail
        actions={actions}
        detail={detail}
        projectId="project-1"
      />,
    );
    for (const label of [
      "Audience",
      "Primary access path",
      "Access evidence",
      "Intended outcome",
      "Outcome evidence",
    ]) {
      expect(html).toContain(`<dt class="font-medium text-sm">${label}</dt>`);
    }
    expect(html).toContain("Optional. These fields never block publishing");
    expect(html).toContain("Contact: Early adopter");
    for (const text of ["Publish date", "Target date", "score", "Required"]) {
      expect(html).not.toContain(text);
    }
  });

  test("lists GitHub and environment references as context, never a status write", () => {
    const html = renderToStaticMarkup(
      <ProjectReleasePlanningDetail
        actions={actions}
        detail={detail}
        projectId="project-1"
      />,
    );
    expect(html).toContain("acme/tidekit");
    expect(html).toContain("A GitHub Release never changes this");
    expect(html).toContain("Add reference");
  });

  test("an archived Project shows the plan without editing controls", () => {
    const html = renderToStaticMarkup(
      <ProjectReleasePlanningDetail
        actions={actions}
        detail={{ ...detail, readOnly: true }}
        projectId="project-1"
      />,
    );
    for (const text of [
      "Add Work to scope",
      "Remove from scope",
      "Edit hypothesis",
      "Add reference",
    ]) {
      expect(html).not.toContain(text);
    }
    expect(html).toContain("TK-1 · Work tk-1");
  });
});
