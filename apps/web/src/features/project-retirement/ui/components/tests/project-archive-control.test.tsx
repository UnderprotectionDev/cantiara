// biome-ignore-all lint/performance/noJsxPropsBind: Test renders pass inline no-op handlers.
// @vitest-environment happy-dom
import type { ArchivePreview } from "@cantiara/api/project-retirement";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const archivedState = vi.hoisted(() => ({ ids: [] as string[] }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#x">{children}</a>,
}));

vi.mock("../../../hooks/use-project-retirement", () => ({
  useArchivePreview: () => ({
    data: undefined,
    isError: false,
    isPending: true,
  }),
  useArchivedProjects: () => ({
    data: {
      projects: archivedState.ids.map((id) => ({ project: { id } })),
    },
    isPending: false,
  }),
  useRetirementTransition: () => ({
    isError: false,
    isPending: false,
    mutate: vi.fn(),
  }),
}));

import { ArchivePreviewPanel } from "../archive-preview-panel";
import ProjectArchiveControl from "../project-archive-control";

describe("Project archive control", () => {
  test("shows the read-only banner on an archived Project", () => {
    archivedState.ids = ["p1"];
    const html = renderToStaticMarkup(<ProjectArchiveControl projectId="p1" />);
    expect(html).toContain("This Project is archived and read-only.");
    expect(html).not.toContain("Delete Project");
  });

  test("offers Archive, not Delete Project, on a working Project", () => {
    archivedState.ids = [];
    const html = renderToStaticMarkup(<ProjectArchiveControl projectId="p1" />);
    expect(html).toContain("Archive");
    expect(html).not.toContain("archived and read-only");
    expect(html).not.toContain("Delete Project");
  });
});

describe("Archive preview panel", () => {
  const preview: ArchivePreview = {
    allowedActions: [{ action: "surface-revoke", label: "Revoke / Unpublish" }],
    githubNotice: "Unarchive does not re-enable GitHub.",
    inFlight: [{ kind: "Import", state: "Applying" }],
    leaves: ["Work"],
    project: {
      archivedAt: null,
      id: "p1",
      name: "Atlas",
      revision: 3,
      shortCode: "ATL",
      status: "Completed",
    },
    securityActions: [],
    stops: ["github-sync", "automation", "reminder", "normal-write"],
    surfaces: [
      {
        sourceKind: "Document",
        sourceState: "Unchanged since approval",
        status: "Active",
        surfaceId: "s1",
        title: "Launch notes",
        visibility: "Link",
      },
    ],
  };

  test("states the departure, exact in-flight states, surfaces and open actions", () => {
    const html = renderToStaticMarkup(
      <ArchivePreviewPanel
        busy={false}
        onCancel={() => undefined}
        onConfirm={() => undefined}
        preview={preview}
      />,
    );
    expect(html).toContain("Atlas");
    expect(html).toContain("Completed status does not change");
    expect(html).toContain("Import: Applying");
    expect(html).toContain("GitHub sync stops");
    expect(html).toContain("Launch notes");
    expect(html).toContain("Revoke / Unpublish");
    expect(html).toContain("Archive Project");
  });
});
