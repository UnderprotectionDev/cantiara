// biome-ignore-all lint/performance/noJsxPropsBind: Test renders pass inline no-op handlers.
// @vitest-environment happy-dom
import {
  type ArchivedProjectEntry,
  DELETE_OWN_REMOVAL_NOTICE,
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
  trash: null,
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

  test("exposes Unarchive and Delete Project as named, keyboard-focusable buttons", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(
      <ArchiveView
        error={false}
        loading={false}
        onDelete={() => undefined}
        onUnarchive={() => undefined}
        projects={[entry]}
      />,
    );
    const buttons = [...container.querySelectorAll("button")];
    for (const name of ["Unarchive", "Delete Project"]) {
      const button = buttons.find((item) => item.textContent?.trim() === name);
      expect(button, name).toBeDefined();
      expect(button?.disabled).toBe(false);
      expect(button?.getAttribute("tabindex")).not.toBe("-1");
    }
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
          ownRemovalSurfaces: [],
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

  test("names a Build in Public surface as own removal instead of promised revocation", () => {
    const [bip] = entry.surfaces;
    const html = renderToStaticMarkup(
      <DeletePreviewPanel
        busy={false}
        onCancel={() => undefined}
        onConfirm={() => undefined}
        preview={{
          group: [],
          integrationsStop: [],
          keepApprovedSurface: { available: false },
          notices: [DELETE_RESTORE_NOTICE, DELETE_OWN_REMOVAL_NOTICE],
          project: entry.project,
          relations: [],
          revokedSurfaces: [],
          ownRemovalSurfaces: [bip],
          visitorSessionsEnd: false,
        }}
      />,
    );
    expect(html).toContain("Build in Public surfaces to remove first");
    expect(html).toContain("Launch notes · Link · not revoked here");
    expect(html).toContain("It is not revoked by Delete Project.");
    expect(html).not.toContain("revoked now, terminal");
  });

  test("marks a Project in Trash, offers Restore to Archive and hides Unarchive and Delete Project", () => {
    const trashed: ArchivedProjectEntry = {
      ...entry,
      trash: {
        baseRevision: 3,
        entryId: "e1",
        expiresAt: "2026-12-02T00:00:00.000Z",
        groupId: "g1",
        mark: "In Trash",
        trashedAt: "2026-11-02T00:00:00.000Z",
      },
    };
    const html = renderToStaticMarkup(
      <ArchiveView
        error={false}
        loading={false}
        onDelete={() => undefined}
        onRestore={() => undefined}
        onUnarchive={() => undefined}
        projects={[trashed]}
      />,
    );
    expect(html).toContain("In Trash");
    expect(html).toContain("Restore to Archive");
    expect(html).toContain(
      "Restoring returns the Project to Archive. No surface is republished and GitHub stays disconnected.",
    );
    expect(html).toContain("Republishing requires a new approval.");
    expect(html).not.toContain("Delete Project");
    expect(html).not.toContain(">Unarchive<");
    expect(html).not.toContain("Keep approved surface");
  });

  test("says so when nothing is archived", () => {
    expect(render([])).toContain("No Project is archived.");
  });
});
