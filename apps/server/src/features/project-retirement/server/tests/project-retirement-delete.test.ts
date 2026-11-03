import type { SurfaceRow } from "@cantiara/api/external-surface-management";
import {
  DELETE_OWN_REMOVAL_NOTICE,
  DELETE_RESTORE_NOTICE,
  DELETED_TARGET_MARK,
  type DeleteGroupMember,
  type RetirementProject,
} from "@cantiara/api/project-retirement";
import type {
  MoveProjectDeleteGroupInput,
  TrashEntry,
} from "@cantiara/api/trash";
import { describe, expect, it } from "vitest";

import { createProjectRetirement } from "../project-retirement";

const ACCOUNT = "account-1";
const CLOCK = "2026-11-02T00:00:00.000Z";
const EXPIRES = "2026-12-02T00:00:00.000Z";

function project(overrides: Partial<RetirementProject> = {}) {
  return {
    archivedAt: "2026-10-01T00:00:00.000Z",
    id: "project-1",
    name: "Atlas",
    revision: 4,
    shortCode: "ATL",
    status: "Completed",
    ...overrides,
  } satisfies RetirementProject;
}

function surface(id: string, visibility: SurfaceRow["visibility"] = "Link") {
  return {
    actions: [],
    expiresAt: null,
    frozenDetached: false,
    hasUnpublishedChanges: false,
    lastApprovedAt: CLOCK,
    passwordProtected: false,
    projectId: "project-1",
    purge: null,
    redaction: "None",
    revision: 1,
    source: {
      id: "doc-1",
      kind: "Document",
      projectId: "project-1",
      title: "N",
    },
    status: "Active",
    surfaceId: id,
    visibility,
  } satisfies SurfaceRow;
}

const MEMBERS: DeleteGroupMember[] = [
  { baseRevision: 2, label: "Ship", recordId: "work-1", recordKind: "Work" },
  { baseRevision: 0, label: "Doc", recordId: "doc-1", recordKind: "Document" },
  {
    baseRevision: 1,
    label: "Link-limited share",
    recordId: "surface-1",
    recordKind: "External Surface",
  },
];

function build(
  current: RetirementProject = project(),
  options: { failMoves?: number; surfaces?: SurfaceRow[] } = {},
) {
  let failures = options.failMoves ?? 0;
  const events: string[] = [];
  const moves: MoveProjectDeleteGroupInput[] = [];
  const revoked: string[] = [];
  const retirement = createProjectRetirement({
    deleteGroup: {
      members: () => {
        events.push("members");
        return Promise.resolve(MEMBERS);
      },
      relations: () =>
        Promise.resolve([
          {
            mark: DELETED_TARGET_MARK,
            scope: "Project other",
            sourceLabel: "Other work",
            targetLabel: "Ship",
          },
        ]),
      revokeSurface: (_account, id) => {
        events.push(`revoke:${id}`);
        revoked.push(id);
        return Promise.resolve({});
      },
    },
    inFlight: () => Promise.resolve([]),
    integrations: () =>
      Promise.resolve([
        { id: "link-1", label: "acme/atlas", state: "Connected" },
      ]),
    store: {
      find: (_account, id) =>
        Promise.resolve(id === current.id ? current : null),
      listArchived: () => Promise.resolve([current]),
      transition: () => Promise.reject(new Error("no archive write on delete")),
    },
    surfaces: () =>
      Promise.resolve(
        options.surfaces ?? [surface("surface-1"), surface("surface-2")],
      ),
    trash: {
      overview: () => Promise.resolve({ entries: [], retentionDays: 30 }),
      restore: () => Promise.resolve(null),
      // One group id, one trashed instant, one expiry for every member.
      moveGroup: (_account, input) => {
        events.push("move");
        if (failures > 0) {
          failures -= 1;
          return Promise.reject(new Error("trash unavailable"));
        }
        moves.push(input);
        return Promise.resolve(
          input.members.map(
            (member, index): TrashEntry => ({
              expiresAt: EXPIRES,
              groupId: "group-1",
              id: `entry-${index}`,
              projectId: input.projectId,
              recordId: member.recordId,
              recordKind: member.recordKind,
              recordLabel: member.recordId,
              revision: member.baseRevision + 1,
              trashedAt: CLOCK,
              workspaceId: "workspace-1",
            }),
          ),
        );
      },
    },
  });
  return { events, moves, retirement, revoked };
}

const COMMAND = {
  baseRevision: 4,
  clientIdempotencyKey: "delete-1",
  projectId: "project-1",
};

describe("Project Retirement delete from Archive", () => {
  it("is absent for an Active Project: preview and delete are refused and nothing moves", async () => {
    const { moves, retirement, revoked } = build(project({ archivedAt: null }));
    await expect(
      retirement.previewDelete(ACCOUNT, { projectId: "project-1" }),
    ).rejects.toMatchObject({ code: "not_archived" });
    await expect(
      retirement.deleteProject(ACCOUNT, COMMAND),
    ).rejects.toMatchObject({ code: "not_archived" });
    expect(moves).toEqual([]);
    expect(revoked).toEqual([]);
  });

  it("refuses an unknown Project and a stale base revision without writing", async () => {
    const { moves, retirement, revoked } = build();
    await expect(
      retirement.deleteProject(ACCOUNT, { ...COMMAND, projectId: "missing" }),
    ).rejects.toMatchObject({ code: "project_not_found" });
    await expect(
      retirement.deleteProject(ACCOUNT, { ...COMMAND, baseRevision: 1 }),
    ).rejects.toMatchObject({ code: "STALE_BASE_REVISION" });
    expect(moves).toEqual([]);
    expect(revoked).toEqual([]);
  });

  it("previews the group, revocations, integrations, relations and the no-republish notice, never Keep approved surface", async () => {
    const { retirement } = build();
    const preview = await retirement.previewDelete(ACCOUNT, {
      projectId: "project-1",
    });

    // Active surfaces join the group even though they are revoked only at commit.
    expect(preview.group).toEqual([
      ...MEMBERS,
      {
        baseRevision: 1,
        label: "N",
        recordId: "surface-2",
        recordKind: "External Surface",
      },
    ]);
    expect(preview.revokedSurfaces.map((entry) => entry.surfaceId)).toEqual([
      "surface-1",
      "surface-2",
    ]);
    expect(preview.visitorSessionsEnd).toBe(true);
    expect(preview.integrationsStop).toEqual([
      { id: "link-1", label: "acme/atlas", state: "Connected" },
    ]);
    expect(preview.relations).toEqual([
      expect.objectContaining({ mark: "In Trash" }),
    ]);
    expect(preview.notices).toContain(DELETE_RESTORE_NOTICE);
    expect(preview.keepApprovedSurface).toEqual({ available: false });
    expect(JSON.stringify(preview)).not.toContain("Keep approved surface");
  });

  it("revokes every Active surface first, then hands the whole group to Trash as one unit", async () => {
    const { events, moves, retirement, revoked } = build();

    const deleted = await retirement.deleteProject(ACCOUNT, COMMAND);

    expect(revoked.sort()).toEqual(["surface-1", "surface-2"]);
    // Revocation precedes the member read and the move.
    expect(events.slice(2)).toEqual(["members", "move"]);
    expect(moves).toHaveLength(1);
    expect(moves[0]?.members.map((member) => member.recordId)).toEqual([
      "work-1",
      "doc-1",
      "surface-1",
    ]);
    expect(deleted).toMatchObject({
      expiresAt: EXPIRES,
      groupId: "group-1",
      records: 3,
      trashedAt: CLOCK,
    });
    expect(deleted.revokedSurfaceIds.sort()).toEqual([
      "surface-1",
      "surface-2",
    ]);
  });

  it("never passes a surface disposition to Trash and rejects one from the caller", async () => {
    const { moves, retirement } = build();
    await expect(
      retirement.deleteProject(ACCOUNT, {
        ...COMMAND,
        surfaceDisposition: "keep",
      } as never),
    ).rejects.toThrow();
    expect(moves).toEqual([]);

    await retirement.deleteProject(ACCOUNT, COMMAND);
    expect(Object.keys(moves[0] ?? {}).sort()).toEqual([
      "clientIdempotencyKey",
      "members",
      "projectId",
    ]);
  });

  it("keeps surfaces revoked and the Project untrashed when the move fails, and a retry with the same key succeeds", async () => {
    const { moves, retirement, revoked } = build(project(), { failMoves: 1 });

    await expect(retirement.deleteProject(ACCOUNT, COMMAND)).rejects.toThrow(
      "trash unavailable",
    );
    expect(revoked.sort()).toEqual(["surface-1", "surface-2"]);
    expect(moves).toEqual([]);

    const deleted = await retirement.deleteProject(ACCOUNT, COMMAND);
    expect(deleted.groupId).toBe("group-1");
    expect(moves).toHaveLength(1);
    expect(moves[0]?.clientIdempotencyKey).toBe(COMMAND.clientIdempotencyKey);
  });

  it("refuses the delete with nothing revoked while a Build in Public surface is active", async () => {
    const buildInPublic = surface("surface-bip", "Build in Public");
    const { events, moves, retirement, revoked } = build(project(), {
      surfaces: [surface("surface-1"), buildInPublic],
    });

    await expect(
      retirement.deleteProject(ACCOUNT, COMMAND),
    ).rejects.toMatchObject({ code: "build_in_public_surface" });
    expect(events).toEqual([]);
    expect(moves).toEqual([]);
    expect(revoked).toEqual([]);
  });

  it("names the Build in Public surface in the preview instead of promising its revocation", async () => {
    const buildInPublic = surface("surface-bip", "Build in Public");
    const { retirement } = build(project(), {
      surfaces: [surface("surface-1"), buildInPublic],
    });

    const preview = await retirement.previewDelete(ACCOUNT, {
      projectId: "project-1",
    });

    expect(preview.revokedSurfaces.map((entry) => entry.surfaceId)).toEqual([
      "surface-1",
    ]);
    expect(preview.ownRemovalSurfaces.map((entry) => entry.surfaceId)).toEqual([
      "surface-bip",
    ]);
    expect(preview.notices).toContain(DELETE_OWN_REMOVAL_NOTICE);
    expect(
      preview.group.find((member) => member.recordId === "surface-bip"),
    ).toBeUndefined();
  });
});
