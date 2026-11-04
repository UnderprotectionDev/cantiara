import type { SurfaceRow } from "@cantiara/api/external-surface-management";
import {
  ARCHIVE_GITHUB_NOTICE,
  ARCHIVE_REFUSED_ACTIONS,
  ARCHIVE_SECURITY_ACTIONS,
  ARCHIVE_STOPPED_ACTIVITIES,
  assertArchivedProjectAllows,
  evaluateArchivedProjectAction,
  ProjectRetirementError,
  type RetirementProject,
} from "@cantiara/api/project-retirement";
import { describe, expect, it } from "vitest";

import {
  createProjectRetirement,
  type ProjectRetirementStore,
  type RetirementTransition,
} from "../project-retirement";

const ACCOUNT = "account-1";

function project(
  overrides: Partial<RetirementProject> = {},
): RetirementProject {
  return {
    archivedAt: null,
    id: "project-1",
    name: "Atlas",
    revision: 3,
    shortCode: "ATL",
    status: "Completed",
    ...overrides,
  };
}

function surface(overrides: Partial<SurfaceRow> = {}): SurfaceRow {
  return {
    actions: ["Open source", "Revoke / Unpublish"],
    expiresAt: null,
    frozenDetached: false,
    hasUnpublishedChanges: false,
    lastApprovedAt: "2026-10-01T00:00:00.000Z",
    passwordProtected: true,
    projectId: "project-1",
    purge: null,
    redaction: "None",
    revision: 1,
    source: {
      id: "doc-1",
      kind: "Document",
      projectId: "project-1",
      title: "Launch notes",
    },
    status: "Active",
    surfaceId: "surface-1",
    visibility: "Link",
    ...overrides,
  };
}

/** The revision barrier as a double: a stale base revision conflicts, a key replays. */
function createStore(initial: RetirementProject) {
  const state = { project: initial };
  const receipts = new Map<string, RetirementProject>();
  const writes: RetirementTransition[] = [];
  const store: ProjectRetirementStore = {
    find: (_account, id) =>
      Promise.resolve(id === state.project.id ? state.project : null),
    listArchived: () =>
      Promise.resolve(state.project.archivedAt ? [state.project] : []),
    transition: (_account, input) => {
      const replay = receipts.get(input.clientIdempotencyKey);
      if (replay) {
        return Promise.resolve(replay);
      }
      if (input.baseRevision !== state.project.revision) {
        return Promise.reject(
          Object.assign(new Error("stale"), { code: "STALE_BASE_REVISION" }),
        );
      }
      writes.push(input);
      // Only the archive column and the revision move; the status stays.
      state.project = {
        ...state.project,
        archivedAt: input.archived ? "2026-11-02T00:00:00.000Z" : null,
        revision: state.project.revision + 1,
      };
      receipts.set(input.clientIdempotencyKey, state.project);
      return Promise.resolve(state.project);
    },
  };
  return { state, store, writes };
}

function build(initial: RetirementProject, rows: SurfaceRow[] = [surface()]) {
  const fixture = createStore(initial);
  const retirement = createProjectRetirement({
    deleteGroup: {
      members: () => Promise.resolve([]),
      relations: () => Promise.resolve([]),
      revokeSurface: () => Promise.resolve(null),
    },
    trash: {
      moveGroup: () => Promise.resolve(null),
      overview: () => Promise.resolve({ entries: [], retentionDays: 30 }),
      restore: () => Promise.resolve(null),
    },
    inFlight: () =>
      Promise.resolve([{ kind: "Import" as const, state: "Applying" }]),
    integrations: () =>
      Promise.resolve([
        { id: "link-1", label: "acme/atlas", state: "Connected" },
      ]),
    store: fixture.store,
    surfaces: () => Promise.resolve(rows),
  });
  return { ...fixture, retirement };
}

const ARCHIVE_COMMAND = {
  baseRevision: 3,
  clientIdempotencyKey: "archive-1",
  projectId: "project-1",
};

describe("Project Retirement archive", () => {
  it("archives through the revision barrier and keeps the life-cycle status", async () => {
    const { retirement, state, writes } = build(project());

    const archived = await retirement.archive(ACCOUNT, ARCHIVE_COMMAND);

    expect(archived.archivedAt).not.toBeNull();
    expect(archived.status).toBe("Completed");
    expect(state.project.status).toBe("Completed");
    expect(writes).toEqual([{ ...ARCHIVE_COMMAND, archived: true }]);
  });

  it("conflicts on a stale base revision and replays the same key", async () => {
    const { retirement, writes } = build(project());
    await expect(
      retirement.archive(ACCOUNT, {
        ...ARCHIVE_COMMAND,
        baseRevision: 1,
        clientIdempotencyKey: "archive-stale",
      }),
    ).rejects.toMatchObject({ code: "STALE_BASE_REVISION" });
    expect(writes).toEqual([]);

    const first = await retirement.archive(ACCOUNT, ARCHIVE_COMMAND);
    expect(first.revision).toBe(4);
  });

  it("refuses to archive twice and to unarchive a working Project", async () => {
    const { retirement } = build(project());
    await retirement.archive(ACCOUNT, ARCHIVE_COMMAND);
    await expect(
      retirement.archive(ACCOUNT, {
        ...ARCHIVE_COMMAND,
        baseRevision: 4,
        clientIdempotencyKey: "archive-2",
      }),
    ).rejects.toMatchObject({ code: "already_archived" });

    const working = build(project());
    await expect(
      working.retirement.unarchive(ACCOUNT, {
        ...ARCHIVE_COMMAND,
        clientIdempotencyKey: "unarchive-1",
      }),
    ).rejects.toMatchObject({ code: "not_archived" });
  });

  it("answers an unknown Project as unavailable", async () => {
    const { retirement } = build(project());
    await expect(
      retirement.preview(ACCOUNT, { projectId: "missing" }),
    ).rejects.toBeInstanceOf(ProjectRetirementError);
  });
});

describe("Project Retirement preview", () => {
  it("shows the departure, in-flight states, living surfaces and open security actions without writing", async () => {
    const { retirement, writes } = build(project());

    const preview = await retirement.preview(ACCOUNT, {
      projectId: "project-1",
    });

    expect(preview.project.revision).toBe(3);
    expect(preview.leaves.length).toBeGreaterThan(0);
    expect(preview.stops).toEqual([...ARCHIVE_STOPPED_ACTIVITIES]);
    expect(preview.inFlight).toEqual([{ kind: "Import", state: "Applying" }]);
    expect(preview.surfaces).toEqual([
      expect.objectContaining({
        sourceState: "Unchanged since approval",
        surfaceId: "surface-1",
        title: "Launch notes",
      }),
    ]);
    expect(preview.allowedActions.map((entry) => entry.action)).toEqual([
      ...ARCHIVE_SECURITY_ACTIONS,
    ]);
    expect(preview.securityActions.map((entry) => entry.action)).toEqual([
      "surface-revoke",
      "security-redaction",
      "token-rotation",
      "session-end",
      "password-rotation",
      "integration-disconnect",
      "integration-secret-rotation",
    ]);
    expect(preview.githubNotice).toBe(ARCHIVE_GITHUB_NOTICE);
    expect(writes).toEqual([]);
  });

  it("does not list a revoked or expired surface as living", async () => {
    const { retirement } = build(project(), [
      surface({ status: "Revoked", surfaceId: "gone" }),
      surface({ status: "Expired", surfaceId: "old" }),
      surface({ frozenDetached: true, surfaceId: "frozen" }),
    ]);
    const preview = await retirement.preview(ACCOUNT, {
      projectId: "project-1",
    });
    expect(preview.surfaces.map((entry) => entry.surfaceId)).toEqual([
      "frozen",
    ]);
    expect(preview.surfaces[0]?.sourceState).toBe("Source detached");
  });
});

describe("Archive view", () => {
  it("lists only archived Projects with their living surfaces and source states", async () => {
    const { retirement } = build(project());
    expect((await retirement.list(ACCOUNT)).projects).toEqual([]);

    await retirement.archive(ACCOUNT, ARCHIVE_COMMAND);
    const view = await retirement.list(ACCOUNT);

    expect(view.projects).toHaveLength(1);
    expect(view.projects[0]?.project.status).toBe("Completed");
    expect(view.projects[0]?.surfaces[0]?.sourceState).toBe(
      "Unchanged since approval",
    );
    expect(view.projects[0]?.securityActions[0]?.source.title).toBe(
      "Launch notes",
    );
  });

  it("is not Trash or a hide filter: no delete is offered and no Trash state appears", async () => {
    const { retirement } = build(project());
    await retirement.archive(ACCOUNT, ARCHIVE_COMMAND);
    const text = JSON.stringify(await retirement.list(ACCOUNT));
    expect(text).not.toContain("Delete Project");
    expect(text).not.toContain("Keep approved surface");
    // Only the explicit "not in Trash" marker (`trash: null`) may appear.
    expect(text.toLowerCase().replace('"trash":null', "")).not.toContain(
      "trash",
    );
  });
});

describe("Unarchive", () => {
  it("returns the Project to work, keeps the status, and enables no GitHub link", async () => {
    const { retirement, state } = build(project());
    await retirement.archive(ACCOUNT, ARCHIVE_COMMAND);

    // The module has no GitHub write port, so Unarchive cannot enable a link;
    // the Archive view only points at the canonical Reconnect.
    const restored = await retirement.unarchive(ACCOUNT, {
      ...ARCHIVE_COMMAND,
      baseRevision: 4,
      clientIdempotencyKey: "unarchive-1",
    });

    expect(restored.archivedAt).toBeNull();
    expect(restored.status).toBe("Completed");
    expect(state.project.revision).toBe(5);
    expect(ARCHIVE_GITHUB_NOTICE).toContain("Reconnect");
    expect(ARCHIVE_GITHUB_NOTICE).toContain("does not re-enable GitHub");
  });
});

describe("Arşiv güvenlik istisnası allow-list", () => {
  const archived = { archivedAt: "2026-11-02T00:00:00.000Z" };

  it("passes every access-reducing action on an archived Project", () => {
    for (const action of ARCHIVE_SECURITY_ACTIONS) {
      expect(evaluateArchivedProjectAction(archived, action)).toEqual({
        allowed: true,
        reason: "access-reducing",
      });
    }
  });

  it("refuses publish, reactivation, password removal, content edit and access widening", () => {
    for (const action of ARCHIVE_REFUSED_ACTIONS) {
      expect(evaluateArchivedProjectAction(archived, action).allowed).toBe(
        false,
      );
      expect(() => assertArchivedProjectAllows(archived, action)).toThrow(
        ProjectRetirementError,
      );
    }
  });

  it("fails closed on normal writes, sync, automation, reminders and unknown actions", () => {
    for (const action of [...ARCHIVE_STOPPED_ACTIVITIES, "something-new", ""]) {
      expect(evaluateArchivedProjectAction(archived, action).allowed).toBe(
        false,
      );
    }
  });

  it("leaves a working Project to its normal rules", () => {
    expect(
      evaluateArchivedProjectAction({ archivedAt: null }, "publish"),
    ).toEqual({ allowed: true, reason: "not-archived" });
  });

  it("keeps the allow-list free of every refused action", () => {
    for (const refused of ARCHIVE_REFUSED_ACTIONS) {
      expect(ARCHIVE_SECURITY_ACTIONS as readonly string[]).not.toContain(
        refused,
      );
    }
  });
});
