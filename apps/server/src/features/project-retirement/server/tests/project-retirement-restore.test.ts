import type { SurfaceRow } from "@cantiara/api/external-surface-management";
import {
  PROJECT_IN_TRASH_MARK,
  REPUBLISH_APPROVAL_NOTICE,
  RESTORE_TO_ARCHIVE_LABEL,
  RESTORE_TO_ARCHIVE_RESULT,
  type RetirementProject,
} from "@cantiara/api/project-retirement";
import type {
  RestoreFromTrashInput,
  RestoreResult,
  TrashEntry,
} from "@cantiara/api/trash";
import { describe, expect, it } from "vitest";

import { createProjectRetirement } from "../project-retirement";

const ACCOUNT = "account-1";
const CLOCK = "2026-11-02T00:00:00.000Z";
const EXPIRES = "2026-12-02T00:00:00.000Z";

const ARCHIVED: RetirementProject = {
  archivedAt: "2026-10-01T00:00:00.000Z",
  id: "project-1",
  name: "Atlas",
  revision: 4,
  shortCode: "ATL",
  status: "Completed",
};

function entry(
  id: string,
  recordId: string,
  kind: string,
  groupId = "group-1",
) {
  return {
    expiresAt: EXPIRES,
    groupId,
    id,
    projectId: "project-1",
    recordId,
    recordKind: kind,
    recordLabel: recordId,
    revision: 3,
    trashedAt: CLOCK,
    workspaceId: "workspace-1",
  } as TrashEntry;
}

/**
 * Trash double with a real group: restoring any entry restores the whole
 * group under the same record ids, a stale base revision restores nothing and
 * a repeated key replays the first receipt. It records every call so the test
 * can prove no surface, token or GitHub port was touched.
 */
function build(options: { inTrash?: boolean; plainEntry?: boolean } = {}) {
  const { inTrash = true, plainEntry = false } = options;
  let entries: TrashEntry[] = [];
  if (inTrash) {
    entries = [
      entry("e-b", "doc-1", "Document"),
      entry("e-a", "work-1", "Work"),
      entry("e-c", "surface-1", "External Surface"),
    ];
  }
  if (plainEntry) {
    entries = [{ ...entry("e-plain", "work-9", "Work"), groupId: null }];
  }
  const receipts = new Map<string, RestoreResult>();
  const restores: RestoreFromTrashInput[] = [];
  const calls: string[] = [];
  const retirement = createProjectRetirement({
    deleteGroup: {
      members: () => Promise.resolve([]),
      relations: () => Promise.resolve([]),
      revokeSurface: () => {
        calls.push("revokeSurface");
        return Promise.resolve(null);
      },
    },
    inFlight: () => Promise.resolve([]),
    integrations: () => {
      calls.push("integrations");
      return Promise.resolve([
        { id: "link-1", label: "acme/atlas", state: "Disconnected" },
      ]);
    },
    store: {
      find: (_account, id) =>
        Promise.resolve(id === ARCHIVED.id ? ARCHIVED : null),
      listArchived: () => Promise.resolve([ARCHIVED]),
      transition: () => {
        calls.push("archive-write");
        return Promise.reject(new Error("restore never rewrites the archive"));
      },
    },
    surfaces: () => {
      calls.push("surfaces");
      return Promise.resolve([
        {
          status: "Revoked",
          surfaceId: "surface-1",
          visibility: "Link",
        } as unknown as SurfaceRow,
      ]);
    },
    trash: {
      moveGroup: () => Promise.reject(new Error("not used")),
      overview: () => Promise.resolve({ entries, retentionDays: 30 }),
      restore: (_account, input) => {
        restores.push(input);
        const earlier = receipts.get(input.clientIdempotencyKey);
        if (earlier) {
          return Promise.resolve(earlier);
        }
        const target = entries.find(
          (candidate) => candidate.id === input.entryId,
        );
        if (!target) {
          return Promise.resolve(null);
        }
        if (input.baseRevision !== target.revision) {
          return Promise.reject(
            Object.assign(new Error("stale"), {
              code: "STALE_BASE_REVISION",
              currentRevision: target.revision,
            }),
          );
        }
        const result: RestoreResult = {
          entryId: target.id,
          groupId: target.groupId,
          projectId: target.projectId,
          records: entries.map((member) => ({
            recordId: member.recordId,
            recordKind: member.recordKind,
            revision: member.revision + 1,
          })),
          restoredAt: CLOCK,
        };
        receipts.set(input.clientIdempotencyKey, result);
        entries = [];
        return Promise.resolve(result);
      },
    },
  });
  return { calls, restores, retirement };
}

const COMMAND = {
  baseRevision: 3,
  clientIdempotencyKey: "restore-1",
  entryId: "e-a",
  projectId: "project-1",
};

describe("Project Retirement restore to Archive", () => {
  it("marks a Project whose group waits in Trash, one deterministic entry names it", async () => {
    const { retirement } = build();
    const view = await retirement.list(ACCOUNT);
    expect(view.projects[0]?.trash).toEqual({
      baseRevision: 3,
      entryId: "e-a",
      expiresAt: EXPIRES,
      groupId: "group-1",
      mark: PROJECT_IN_TRASH_MARK,
      trashedAt: CLOCK,
    });
    const clean = await build({ inTrash: false }).retirement.list(ACCOUNT);
    expect(clean.projects[0]?.trash).toBeNull();
  });

  it("refuses a second Delete Project and Unarchive while the group is in Trash", async () => {
    const { retirement } = build();
    await expect(
      retirement.deleteProject(ACCOUNT, {
        baseRevision: 4,
        clientIdempotencyKey: "d",
        projectId: "project-1",
      }),
    ).rejects.toMatchObject({ code: "project_in_trash" });
    await expect(
      retirement.previewDelete(ACCOUNT, { projectId: "project-1" }),
    ).rejects.toMatchObject({ code: "project_in_trash" });
    await expect(
      retirement.unarchive(ACCOUNT, {
        baseRevision: 4,
        clientIdempotencyKey: "u",
        projectId: "project-1",
      }),
    ).rejects.toMatchObject({ code: "project_in_trash" });
  });

  it("restores the whole group under the same identities and writes nothing else", async () => {
    const { calls, retirement } = build();

    const restored = await retirement.restoreToArchive(ACCOUNT, COMMAND);

    expect(restored.records.map((record) => record.recordId).sort()).toEqual([
      "doc-1",
      "surface-1",
      "work-1",
    ]);
    expect(restored.groupId).toBe("group-1");
    expect(restored.notices).toEqual([
      RESTORE_TO_ARCHIVE_RESULT,
      REPUBLISH_APPROVAL_NOTICE,
    ]);
    expect(RESTORE_TO_ARCHIVE_LABEL).toBe("Restore to Archive");
    // Archive, not Active: the archive column is never written, so the
    // Project stays archived with its life-cycle status.
    expect(calls).not.toContain("archive-write");
  });

  it("does not republish, mint a token or reactivate a surface: no surface port is called", async () => {
    const { calls, retirement } = build();
    await retirement.restoreToArchive(ACCOUNT, COMMAND);
    expect(calls).toEqual([]);
    const keys = Object.keys(
      await retirement.restoreToArchive(ACCOUNT, COMMAND),
    ).sort();
    // The result carries no URL, token or asset: only identities and notices.
    expect(keys).toEqual([
      "githubNotice",
      "groupId",
      "notices",
      "projectId",
      "records",
      "restoredAt",
    ]);
  });

  it("leaves GitHub disconnected and points to Reconnect, never Connected", async () => {
    const { retirement } = build();
    const restored = await retirement.restoreToArchive(ACCOUNT, COMMAND);
    expect(restored.githubNotice).toContain("Reconnect");
    expect(JSON.stringify(restored)).not.toContain("Connected");
  });

  it("restores nothing on a stale base revision", async () => {
    const { retirement } = build();
    await expect(
      retirement.restoreToArchive(ACCOUNT, { ...COMMAND, baseRevision: 1 }),
    ).rejects.toMatchObject({ code: "STALE_BASE_REVISION" });
    const view = await retirement.list(ACCOUNT);
    expect(view.projects[0]?.trash).not.toBeNull();
  });

  it("replays the same idempotency key to the same result", async () => {
    const { retirement } = build();
    const first = await retirement.restoreToArchive(ACCOUNT, COMMAND);
    const again = await retirement.restoreToArchive(ACCOUNT, COMMAND);
    expect(again).toEqual(first);
  });

  it("refuses an unknown Project, a non-group Trash entry and a missing entry", async () => {
    await expect(
      build().retirement.restoreToArchive(ACCOUNT, {
        ...COMMAND,
        projectId: "missing",
      }),
    ).rejects.toMatchObject({ code: "project_not_found" });
    await expect(
      build({ plainEntry: true }).retirement.restoreToArchive(ACCOUNT, {
        ...COMMAND,
        entryId: "e-plain",
      }),
    ).rejects.toMatchObject({ code: "not_in_trash" });
    await expect(
      build({ inTrash: false }).retirement.restoreToArchive(ACCOUNT, COMMAND),
    ).rejects.toMatchObject({ code: "not_in_trash" });
  });

  it("rejects a surface or GitHub choice riding on the command", async () => {
    const { restores, retirement } = build();
    await expect(
      retirement.restoreToArchive(ACCOUNT, {
        ...COMMAND,
        surfaceDisposition: "republish",
      } as never),
    ).rejects.toThrow();
    expect(restores).toEqual([]);
  });
});
