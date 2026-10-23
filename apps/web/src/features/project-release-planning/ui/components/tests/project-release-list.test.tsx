import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { ProjectReleaseSummary } from "@cantiara/api/project-release-planning";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { ProjectReleaseList } from "../project-release-list";

const PERCENTAGE = /\d+ ?%(?!\d|[0-9A-F]{2})/;

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a {...props} href={href} />
  ),
}));

function summary(
  name: string,
  status: ProjectReleaseSummary["release"]["status"],
  scope = { completed: 0, open: 0 },
): ProjectReleaseSummary {
  return {
    githubReferences: 0,
    lastChangedAt: "2026-10-20T10:00:00.000Z",
    release: {
      accessEvidence: null,
      audience: null,
      createdAt: "2026-10-20T10:00:00.000Z",
      description: null,
      id: `release-${name}`,
      intendedOutcome: null,
      name,
      outcomeEvidence: null,
      primaryAccessPath: null,
      projectId: "project-1",
      revision: 1,
      sourceType: "Project Release",
      status,
      updatedAt: "2026-10-20T10:00:00.000Z",
      versionLabel: "v1.0.0",
    },
    scope,
  };
}

function render(releases: ProjectReleaseSummary[], readOnly = false) {
  return renderToStaticMarkup(
    <ProjectReleaseList
      createControl={<button type="button">Create Project Release</button>}
      formatting={DEFAULT_ACCOUNT_PREFERENCES}
      overview={{ readOnly, releases }}
      projectId="project-1"
    />,
  );
}

describe("Project Releases overview", () => {
  test("groups releases by status with Version label, scope counts and last change", () => {
    const html = render([
      summary("tidekit 0.9", "Published", { completed: 4, open: 1 }),
      summary("tidekit 1.1", "Preparing", { completed: 2, open: 3 }),
      summary("tidekit 1.2", "Draft"),
    ]);
    const order = ["Draft", "Preparing", "Published"].map((status) =>
      html.indexOf(`aria-label="${status}"`),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(html).not.toContain('aria-label="Cancelled"');
    for (const text of [
      "Project Releases",
      "Version label v1.0.0",
      "Scope: 2 completed, 3 open",
      "Last change",
      "Create Project Release",
      "#source-project-release-release-tidekit%201.1",
    ]) {
      expect(html).toContain(text);
    }
  });

  test("explains the empty state without Milestone or Focus Period semantics", () => {
    const html = render([]);
    expect(html).toContain(
      "A Project Release is the publishable scope of this Project; it is not a Milestone or a Focus Period.",
    );
    expect(html).toContain("Create Project Release");
  });

  test("shows no publish date, readiness score or gate", () => {
    const html = render([summary("tidekit 1.1", "Preparing")]);
    for (const text of ["Publish date", "Target date", "Ready", "score"]) {
      expect(html).not.toContain(text);
    }
    expect(html).not.toMatch(PERCENTAGE);
  });

  test("keeps an archived Project readable without creation", () => {
    const html = render([summary("tidekit 1.1", "Draft")], true);
    expect(html).toContain("read-only");
    expect(html).not.toContain("Create Project Release");
  });
});
