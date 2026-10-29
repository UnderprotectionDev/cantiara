import {
  MutationConflictError,
  MutationStaleBaseRevisionError,
} from "@cantiara/api/mutation-contract";
import {
  TRASH_PERMANENT_DELETE_EVENT_TYPE,
  TrashAlreadyTrashedError,
  TrashChildRecordError,
  type TrashSurface,
} from "@cantiara/api/trash";
import { describe, expect, test, vi } from "vitest";

import { createTrash, type TrashSurfacePort } from "../trash";
import { createTrashMaintenance } from "../trash-expiry";
import { createMemoryTrash } from "../trash-memory-store";

const ACCOUNT = "account-1";
const PROJECT = "project-1";
const DAY_MS = 86_400_000;
const NOW = new Date("2026-03-01T10:00:00.000Z");
const DAY_31 = new Date(NOW.valueOf() + 31 * DAY_MS);
const DAY_29 = new Date(NOW.valueOf() + 29 * DAY_MS);

function setup(surfaces?: TrashSurfacePort) {
  const projects = new Map([
    [
      PROJECT,
      {
        records: new Map<
          string,
          {
            activeSurface?: boolean;
            label: string;
            movable?: boolean;
            revision: number;
            sensitiveContent?: boolean;
          }
        >([
          ["Work:w1", { label: "Ship it", revision: 3 }],
          ["Document:d1", { label: "Notes", revision: 0 }],
          [
            "External Surface:x1",
            { label: "Link-limited share", movable: true, revision: 4 },
          ],
        ]),
        workspaceId: "workspace-1",
      },
    ],
  ]);
  const harness = createMemoryTrash({ accountId: ACCOUNT, projects });
  const flag = (id: string, field: "activeSurface" | "sensitiveContent") => {
    for (const [key, record] of projects.get(PROJECT)?.records ?? []) {
      if (key.endsWith(`:${id}`)) {
        record[field] = true;
      }
    }
  };
  let counter = 0;
  const trash = createTrash(harness.store, {
    newId: () => {
      counter += 1;
      return `id-${counter}`;
    },
    now: () => NOW,
    surfaces,
  });
  const maintenance = createTrashMaintenance(harness.expiry, harness.eventLog);
  return {
    ...harness,
    maintenance,
    markActiveSurface: (id: string) => flag(id, "activeSurface"),
    markSensitive: (id: string) => flag(id, "sensitiveContent"),
    projects,
    trash,
  };
}

const move = (
  kind: string,
  id: string,
  baseRevision: number,
  key = `m-${id}`,
) =>
  ({
    baseRevision,
    clientIdempotencyKey: key,
    projectId: PROJECT,
    recordId: id,
    recordKind: kind,
  }) as never;

const restore = (entryId: string, baseRevision: number, key = `r-${entryId}`) =>
  ({
    baseRevision,
    clientIdempotencyKey: key,
    entryId,
    projectId: PROJECT,
  }) as never;

const groupInput = (key = "g1") =>
  ({
    clientIdempotencyKey: key,
    members: [
      { baseRevision: 3, recordId: "w1", recordKind: "Work" },
      { baseRevision: 0, recordId: "d1", recordKind: "Document" },
    ],
    projectId: PROJECT,
  }) as never;

describe("Trash seam: Restore", () => {
  test("restores the same record id in the same scope and it is living again", async () => {
    const { entries, store, trash } = setup();
    const entry = await trash.move(ACCOUNT, move("Work", "w1", 3));

    const restored = await trash.restore(
      ACCOUNT,
      restore(entry?.id ?? "", entry?.revision ?? -1),
    );

    expect(restored?.records).toEqual([
      { recordId: "w1", recordKind: "Work", revision: 5 },
    ]);
    expect(entries).toHaveLength(0);
    expect(
      await trash.living(ACCOUNT, PROJECT, [{ id: "w1", kind: "Work" }]),
    ).toEqual([{ id: "w1", kind: "Work" }]);
    expect(await store.record(PROJECT, "Work", "w1")).toMatchObject({
      trashed: false,
    });
    expect((await trash.overview(ACCOUNT, PROJECT))?.entries).toEqual([]);
  });

  test("never restores into another account's Project or an unknown entry", async () => {
    const { trash } = setup();
    const entry = await trash.move(ACCOUNT, move("Work", "w1", 3));

    expect(
      await trash.restore("other", restore(entry?.id ?? "", 4)),
    ).toBeNull();
    expect(await trash.restore(ACCOUNT, restore("missing", 4))).toBeNull();
  });

  test("replays the same key and rejects a different payload under it", async () => {
    const { trash } = setup();
    const entry = await trash.move(ACCOUNT, move("Work", "w1", 3));

    const first = await trash.restore(
      ACCOUNT,
      restore(entry?.id ?? "", 4, "k"),
    );
    const again = await trash.restore(
      ACCOUNT,
      restore(entry?.id ?? "", 4, "k"),
    );

    expect(again).toEqual(first);
    await expect(
      trash.restore(ACCOUNT, restore(entry?.id ?? "", 9, "k")),
    ).rejects.toBeInstanceOf(MutationConflictError);
  });

  test("a stale base revision writes nothing and keeps the entry", async () => {
    const { entries, trash } = setup();
    const entry = await trash.move(ACCOUNT, move("Work", "w1", 3));

    await expect(
      trash.restore(ACCOUNT, restore(entry?.id ?? "", 3)),
    ).rejects.toBeInstanceOf(MutationStaleBaseRevisionError);
    expect(entries).toHaveLength(1);
  });

  test("restore does not touch a kept or revoked External Surface", async () => {
    const surface: TrashSurface = {
      kind: "Link-limited share",
      state: "Active",
      surfaceId: "s1",
    };
    const port: TrashSurfacePort = {
      attached: vi.fn(() => Promise.resolve([surface])),
      freeze: vi.fn(() => Promise.resolve(true)),
      revoke: vi.fn(() => Promise.resolve()),
    };
    const { trash } = setup(port);
    const entry = await trash.move(ACCOUNT, {
      baseRevision: 3,
      clientIdempotencyKey: "keep",
      projectId: PROJECT,
      recordId: "w1",
      recordKind: "Work",
      surfaceDisposition: "keep",
    });
    vi.mocked(port.attached).mockClear();
    vi.mocked(port.freeze).mockClear();
    vi.mocked(port.revoke).mockClear();

    await trash.restore(ACCOUNT, restore(entry?.id ?? "", 4));

    expect(port.freeze).not.toHaveBeenCalled();
    expect(port.revoke).not.toHaveBeenCalled();
    expect(port.attached).not.toHaveBeenCalled();
  });

  test("a revoked External Surface record restores and stays a record, not a publish", async () => {
    const { store, trash } = setup();
    const entry = await trash.move(ACCOUNT, move("External Surface", "x1", 4));

    const restored = await trash.restore(ACCOUNT, restore(entry?.id ?? "", 5));

    expect(restored?.records[0]).toMatchObject({
      recordId: "x1",
      recordKind: "External Surface",
    });
    expect(await store.record(PROJECT, "External Surface", "x1")).toMatchObject(
      {
        movable: true,
        trashed: false,
      },
    );
  });
});

describe("Trash seam: Project delete group", () => {
  test("moves the group on one shared clock, all or nothing", async () => {
    const { entries, trash } = setup();

    const group = await trash.moveGroup(ACCOUNT, groupInput());

    expect(group).toHaveLength(2);
    expect(new Set(group?.map((e) => e.groupId)).size).toBe(1);
    expect(group?.[0]?.groupId).not.toBeNull();
    expect(new Set(group?.map((e) => e.expiresAt)).size).toBe(1);
    expect(entries).toHaveLength(2);
  });

  test("a stale member moves nothing of the group", async () => {
    const { entries, trash } = setup();
    const input = {
      clientIdempotencyKey: "stale",
      projectId: PROJECT,
      members: [
        { baseRevision: 3, recordId: "w1", recordKind: "Work" },
        { baseRevision: 7, recordId: "d1", recordKind: "Document" },
      ],
    } as never;

    await expect(trash.moveGroup(ACCOUNT, input)).rejects.toBeInstanceOf(
      MutationStaleBaseRevisionError,
    );
    expect(entries).toHaveLength(0);
  });

  test("replays the same key with the same group and refuses a child record", async () => {
    const { entries, trash } = setup();
    const first = await trash.moveGroup(ACCOUNT, groupInput("g"));
    const again = await trash.moveGroup(ACCOUNT, groupInput("g"));

    expect(again?.map((e) => e.id).sort()).toEqual(
      first?.map((e) => e.id).sort(),
    );
    expect(entries).toHaveLength(2);
    await expect(
      trash.moveGroup(ACCOUNT, {
        clientIdempotencyKey: "c",
        members: [
          { baseRevision: 0, recordId: "st1", recordKind: "Session Test" },
        ],
        projectId: PROJECT,
      } as never),
    ).rejects.toBeInstanceOf(TrashChildRecordError);
  });

  test("revokes every Active surface and never keeps one", async () => {
    const surface: TrashSurface = {
      kind: "Link-limited share",
      state: "Active",
      surfaceId: "s1",
    };
    const port: TrashSurfacePort = {
      attached: vi.fn(() => Promise.resolve([surface])),
      freeze: vi.fn(() => Promise.resolve(true)),
      revoke: vi.fn(() => Promise.resolve()),
    };
    const { trash } = setup(port);

    await trash.moveGroup(ACCOUNT, groupInput());

    expect(port.freeze).not.toHaveBeenCalled();
    expect(port.revoke).toHaveBeenCalledTimes(2);
  });

  test("restoring any member restores the whole group atomically, same ids", async () => {
    const { entries, trash } = setup();
    const group = await trash.moveGroup(ACCOUNT, groupInput());
    const child = group?.find((e) => e.recordId === "d1");

    const restored = await trash.restore(
      ACCOUNT,
      restore(child?.id ?? "", child?.revision ?? -1),
    );

    expect(restored?.groupId).toBe(child?.groupId);
    expect(restored?.records.map((r) => r.recordId).sort()).toEqual([
      "d1",
      "w1",
    ]);
    expect(entries).toHaveLength(0);
  });

  test("a stale group member restores none of the group", async () => {
    const { entries, store, trash } = setup();
    const group = await trash.moveGroup(ACCOUNT, groupInput());
    const child = group?.find((e) => e.recordId === "d1");

    await expect(
      trash.restore(ACCOUNT, restore(child?.id ?? "", 99)),
    ).rejects.toBeInstanceOf(MutationStaleBaseRevisionError);
    expect(entries).toHaveLength(2);
    expect(await store.record(PROJECT, "Work", "w1")).toMatchObject({
      trashed: true,
    });
  });

  test("a group member cannot move again on its own clock", async () => {
    const { trash } = setup();
    await trash.moveGroup(ACCOUNT, groupInput());

    await expect(
      trash.move(ACCOUNT, move("Work", "w1", 4, "again")),
    ).rejects.toBeInstanceOf(TrashAlreadyTrashedError);
  });
});

describe("Trash seam: duration-end permanent delete", () => {
  test("keeps a record whose 30 days have not ended and deletes it after", async () => {
    const { entries, maintenance, trash } = setup();
    await trash.move(ACCOUNT, move("Work", "w1", 3));

    expect(await maintenance.sweepExpired(DAY_29)).toMatchObject({
      deleted: 0,
    });
    expect(entries).toHaveLength(1);
    expect(await maintenance.sweepExpired(DAY_31)).toMatchObject({
      deleted: 1,
    });
    expect(entries).toHaveLength(0);
  });

  test("removes the content and leaves only a content-free audit record and security event", async () => {
    const { audit, deletedMarks, events, maintenance, store, trash } = setup();
    await trash.move(ACCOUNT, move("Work", "w1", 3));

    await maintenance.sweepExpired(DAY_31);

    expect(await store.record(PROJECT, "Work", "w1")).toBeNull();
    expect(deletedMarks.has("Work:w1")).toBe(true);
    expect(audit).toHaveLength(1);
    expect(Object.keys(audit[0] ?? {}).sort()).toEqual([
      "actorAlias",
      "id",
      "occurredAt",
      "targetAlias",
      "type",
    ]);
    expect(audit[0]).toMatchObject({
      actorAlias: "system:trash-retention",
      occurredAt: DAY_31.toISOString(),
      targetAlias: "Work:w1",
      type: TRASH_PERMANENT_DELETE_EVENT_TYPE,
    });
    expect(events).toHaveLength(1);
    expect(JSON.stringify([audit, events])).not.toContain("Ship it");
  });

  test("the whole Project delete group is deleted together, never a child alone", async () => {
    const { entries, maintenance, store, trash } = setup();
    await trash.moveGroup(ACCOUNT, groupInput());

    const result = await maintenance.sweepExpired(DAY_31);

    expect(result.deleted).toBe(2);
    expect(entries).toHaveLength(0);
    expect(await store.record(PROJECT, "Work", "w1")).toBeNull();
    expect(await store.record(PROJECT, "Document", "d1")).toBeNull();
  });

  test("a group is not due before its shared clock ends", async () => {
    const { entries, maintenance, trash } = setup();
    await trash.moveGroup(ACCOUNT, groupInput());

    expect(await maintenance.sweepExpired(DAY_29)).toMatchObject({
      deleted: 0,
    });
    expect(entries).toHaveLength(2);
  });

  test("refuses while an active External Surface still uses a record", async () => {
    const memory = setup();
    await memory.trash.move(ACCOUNT, move("Work", "w1", 3));
    // A kept, still-serving surface keeps the record in use.
    memory.markActiveSurface("w1");

    const result = await memory.maintenance.sweepExpired(DAY_31);

    expect(result.deleted).toBe(0);
    expect(result.blocked[0]?.blockers).toEqual(["active-surface"]);
    expect(memory.entries).toHaveLength(1);
    expect(memory.audit).toHaveLength(0);
    expect(memory.events).toHaveLength(0);
  });

  test("refuses while sensitive content has not been removed", async () => {
    const memory = setup();
    await memory.trash.move(ACCOUNT, move("Work", "w1", 3));
    memory.markSensitive("w1");

    const result = await memory.maintenance.sweepExpired(DAY_31);

    expect(result.deleted).toBe(0);
    expect(result.blocked[0]?.blockers).toEqual(["sensitive-content"]);
    expect(memory.entries).toHaveLength(1);
  });

  test("a group with one blocked member deletes none of the group", async () => {
    const memory = setup();
    await memory.trash.moveGroup(ACCOUNT, groupInput());
    memory.markActiveSurface("d1");

    const result = await memory.maintenance.sweepExpired(DAY_31);

    expect(result.deleted).toBe(0);
    expect(memory.entries).toHaveLength(2);
  });

  test("replay erases a record an old backup brought back after its delete", async () => {
    const { events, maintenance, projects, trash } = setup();
    await trash.move(ACCOUNT, move("Work", "w1", 3));
    await maintenance.sweepExpired(DAY_31);
    // An old database copy resurrects the row.
    projects
      .get(PROJECT)
      ?.records.set("Work:w1", { label: "Ship it", revision: 3 });

    expect(await maintenance.replayPermanentDeletes()).toBe(1);

    expect(projects.get(PROJECT)?.records.has("Work:w1")).toBe(false);
    expect(events).toHaveLength(1);
  });
});
