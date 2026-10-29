import {
  MutationConflictError,
  MutationStaleBaseRevisionError,
} from "@cantiara/api/mutation-contract";
import {
  TRASH_RECORD_KINDS,
  TRASH_RETENTION_DAYS,
  TrashAlreadyTrashedError,
  TrashChildRecordError,
} from "@cantiara/api/trash";
import { describe, expect, test } from "vitest";

import { createTrash } from "../trash";
import { createMemoryTrash } from "../trash-memory-store";

const ACCOUNT = "account-1";
const PROJECT = "project-1";
const DAY_MS = 86_400_000;
const NOW = new Date("2026-03-01T10:00:00.000Z");

function setup() {
  const harness = createMemoryTrash({
    accountId: ACCOUNT,
    projects: new Map([
      [
        PROJECT,
        {
          records: new Map([
            ["Work:w1", { label: "Ship it", revision: 3 }],
            ["Document:d1", { label: "Notes", revision: 0 }],
            ["Decision:dc1", { label: "Use Postgres", revision: 1 }],
            ["Risk:r1", { label: "Slip", revision: 2 }],
            ["Screen:s1", { label: "Home", revision: 1 }],
          ]),
          workspaceId: "workspace-1",
        },
      ],
    ]),
  });
  let counter = 0;
  const nextId = () => {
    counter += 1;
    return `entry-${counter}`;
  };
  const trash = createTrash(harness.store, {
    newId: nextId,
    now: () => NOW,
  });
  return { ...harness, trash };
}

const move = (
  recordKind: string,
  recordId: string,
  baseRevision: number,
  clientIdempotencyKey = `key-${recordKind}-${recordId}`,
) =>
  ({
    baseRevision,
    clientIdempotencyKey,
    projectId: PROJECT,
    recordId,
    recordKind,
  }) as never;

describe("Trash seam: Move to Trash", () => {
  test.each([
    ["Work", "w1", 3],
    ["Document", "d1", 0],
    ["Decision", "dc1", 1],
    ["Risk", "r1", 2],
    ["Screen", "s1", 1],
  ] as const)(
    "moves a %s into Trash keeping its identity and scope",
    async (kind, id, revision) => {
      const { trash } = setup();

      const entry = await trash.move(ACCOUNT, move(kind, id, revision));

      expect(entry).toMatchObject({
        groupId: null,
        projectId: PROJECT,
        recordId: id,
        recordKind: kind,
        workspaceId: "workspace-1",
      });
      const overview = await trash.overview(ACCOUNT, PROJECT);
      expect(overview?.entries.map((e) => [e.recordKind, e.recordId])).toEqual([
        [kind, id],
      ]);
    },
  );

  test("covers exactly the first-slice kinds", () => {
    expect([...TRASH_RECORD_KINDS]).toEqual([
      "Work",
      "Document",
      "Decision",
      "Risk",
      "Screen",
    ]);
  });

  test("the recoverable window is exactly 30 product days from the move", async () => {
    const { trash } = setup();

    const entry = await trash.move(ACCOUNT, move("Work", "w1", 3));

    expect(TRASH_RETENTION_DAYS).toBe(30);
    expect(entry?.trashedAt).toBe(NOW.toISOString());
    expect(entry?.expiresAt).toBe(
      new Date(NOW.valueOf() + 30 * DAY_MS).toISOString(),
    );
    expect((await trash.overview(ACCOUNT, PROJECT))?.retentionDays).toBe(30);
  });

  test("a trashed record is no living member of any rule or view", async () => {
    const { trash } = setup();
    const refs = [
      { id: "w1", kind: "Work" as const },
      { id: "d1", kind: "Document" as const },
    ];

    await trash.move(ACCOUNT, move("Work", "w1", 3));

    expect(await trash.living(ACCOUNT, PROJECT, refs)).toEqual([refs[1]]);
  });

  test("the same key and payload returns the same entry and writes once", async () => {
    const { entries, trash } = setup();

    const first = await trash.move(ACCOUNT, move("Work", "w1", 3, "k1"));
    const again = await trash.move(ACCOUNT, move("Work", "w1", 3, "k1"));

    expect(again).toEqual(first);
    expect(entries).toHaveLength(1);
  });

  test("the same key with a different payload is a conflict", async () => {
    const { trash } = setup();
    await trash.move(ACCOUNT, move("Work", "w1", 3, "k1"));

    await expect(
      trash.move(ACCOUNT, move("Work", "w1", 9, "k1")),
    ).rejects.toBeInstanceOf(MutationConflictError);
  });

  test("a stale base revision writes nothing and reports the current revision", async () => {
    const { entries, trash } = setup();

    await expect(
      trash.move(ACCOUNT, move("Work", "w1", 2)),
    ).rejects.toMatchObject({
      code: "STALE_BASE_REVISION",
      currentRevision: 3,
    });
    expect(entries).toHaveLength(0);
    expect(await trash.overview(ACCOUNT, PROJECT)).toMatchObject({
      entries: [],
    });
  });

  test("a record already in Trash cannot move again under a new key", async () => {
    const { trash } = setup();
    await trash.move(ACCOUNT, move("Work", "w1", 3, "k1"));

    await expect(
      trash.move(ACCOUNT, move("Work", "w1", 4, "k2")),
    ).rejects.toBeInstanceOf(TrashAlreadyTrashedError);
  });

  test("a child Session Test cannot be moved to Trash alone", async () => {
    const { entries, trash } = setup();

    await expect(
      trash.move(ACCOUNT, move("Session Test", "st1", 0)),
    ).rejects.toBeInstanceOf(TrashChildRecordError);
    expect(entries).toHaveLength(0);
  });

  test("another account sees neither the Project nor its Trash", async () => {
    const { trash } = setup();

    expect(await trash.move("other", move("Work", "w1", 3))).toBeNull();
    expect(await trash.overview("other", PROJECT)).toBeNull();
    expect(await trash.living("other", PROJECT, [])).toBeNull();
  });

  test("an unknown record is not found and writes nothing", async () => {
    const { entries, trash } = setup();

    expect(await trash.move(ACCOUNT, move("Work", "missing", 0))).toBeNull();
    expect(entries).toHaveLength(0);
  });

  test("lists Trash entries soonest expiry first", async () => {
    const { trash } = setup();
    await trash.move(ACCOUNT, move("Risk", "r1", 2));
    await trash.move(ACCOUNT, move("Screen", "s1", 1));

    const overview = await trash.overview(ACCOUNT, PROJECT);

    expect(overview?.entries).toHaveLength(2);
    const [first, second] = overview?.entries ?? [];
    expect((first?.expiresAt ?? "") <= (second?.expiresAt ?? "")).toBe(true);
  });
});

describe("Trash seam: stale error type", () => {
  test("uses the shared Mutation Contract error", async () => {
    const { trash } = setup();

    await expect(
      trash.move(ACCOUNT, move("Risk", "r1", 0)),
    ).rejects.toBeInstanceOf(MutationStaleBaseRevisionError);
  });
});
