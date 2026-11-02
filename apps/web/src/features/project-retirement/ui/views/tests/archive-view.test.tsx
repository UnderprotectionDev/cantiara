// biome-ignore-all lint/performance/noJsxPropsBind: Test renders pass inline no-op handlers.
// @vitest-environment happy-dom
import {
  type ArchivedProjectEntry,
  DELETE_RESTORE_NOTICE,
} from "@cantiara/api/project-retirement";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#x">{children}</a>,
}));

import { DeletePreviewPanel } from "../../components/delete-preview-panel";
import { ArchiveView } from "../archive-view";

const entry: ArchivedProjectEntry = {
  githubNotice:
    "Unarchive does not re-enable GitHub. Use Reconnect in the Project's GitHub area.",
  project: {
    archivedAt: "2026-11-02T00:00:00.000Z",
    id: "p1",
    name: "Atlas",
    revision: 4,
    shortCode: "ATL",
    status: "Completed",
  },
  securityActions: [
    {
      action: "surface-revoke",
      label: "Revoke / Unpublish",
      source: {
        id: "s1",
        kind: "Link surface",
        state: "Changed since approval",
        title: "Launch notes",
      },
    },
  ],
  surfaces: [
    {
      sourceKind: "Document",
      sourceState: "Changed since approval",
      status: "Active",
      surfaceId: "s1",
      title: "Launch notes",
      visibility: "Link",
    },
  ],
};

function render(projects: ArchivedProjectEntry[]) {
  return renderToStaticMarkup(
    <ArchiveView
      error={false}
      loading={false}
      onUnarchive={() => undefined}
      projects={projects}
    />,
  );
}

describe("Archive view", () => {
  test("lists the Project, its living surfaces and open security actions with source states", () => {
    const html = render([entry]);
    expect(html).toContain("Archive");
    expect(html).toContain("Atlas");
    expect(html).toContain("Completed");
    expect(html).toContain("Launch notes");
    expect(html).toContain("Changed since approval");
    expect(html).toContain("Revoke / Unpublish");
    expect(html).toContain("Unarchive");
  });

  test("points at Reconnect and never offers Keep approved surface", () => {
    const html = render([entry]);
    expect(html).toContain("Unarchive does not re-enable GitHub");
    expect(html).toContain("Reconnect");
    expect(html).not.toContain("Keep approved surface");
  });

  test("offers Delete Project only when the Archive supplies the handler", () => {
    expect(render([entry])).not.toContain("Delete Project");
    const html = renderToStaticMarkup(
      <ArchiveView
        error={false}
        loading={false}
        onDelete={() => undefined}
        onUnarchive={() => undefined}
        projects={[entry]}
      />,
    );
    expect(html).toContain("Delete Project");
  });

  test("the delete preview lists the group, revocations, relations and no-republish notice without Keep approved surface", () => {
    const html = renderToStaticMarkup(
      <DeletePreviewPanel
        busy={false}
        onCancel={() => undefined}
        onConfirm={() => undefined}
        preview={{
          group: [
            {
              baseRevision: 1,
              label: "Ship",
              recordId: "w1",
              recordKind: "Work",
            },
          ],
          integrationsStop: [
            { id: "l1", label: "acme/atlas", state: "Connected" },
          ],
          keepApprovedSurface: { available: false },
          notices: [DELETE_RESTORE_NOTICE],
          project: entry.project,
          relations: [
            {
              mark: "In Trash",
              scope: "Project other",
              sourceLabel: "Other work",
              targetLabel: "Ship",
            },
          ],
          revokedSurfaces: entry.surfaces,
          visitorSessionsEnd: true,
        }}
      />,
    );
    expect(html).toContain("Work: Ship");
    expect(html).toContain("revoked now, terminal");
    expect(html).toContain("Visitor sessions end immediately.");
    expect(html).toContain("acme/atlas");
    expect(html).toContain("In Trash");
    expect(html).toContain("does not republish");
    expect(html).not.toContain("Keep approved surface");
  });

  test("says so when nothing is archived", () => {
    expect(render([])).toContain("No Project is archived.");
  });
});
