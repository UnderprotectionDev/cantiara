import { TrashChildRecordError } from "@cantiara/api/trash";
import { describe, expect, test } from "vitest";

import { createTrash } from "../trash";
import { createMemoryTrash } from "./trash-memory-store";

const ACCOUNT = "account-1";
const PROJECT = "project-1";
const NOW = new Date("2026-03-01T10:00:00.000Z");

function setup() {
  const harness = createMemoryTrash({
    accountId: ACCOUNT,
    projects: new Map([
      [
        PROJECT,
        {
          records: new Map([
            ["GitHub External Record:g1", { label: "#12 Fix", revision: 0 }],
            ["Test Session:ts1", { label: "Nightly run", revision: 2 }],
          ]),
          workspaceId: "workspace-1",
        },
      ],
    ]),
  });
  let counter = 0;
  const trash = createTrash(harness.store, {
    newId: () => {
      counter += 1;
      return `entry-${counter}`;
    },
    now: () => NOW,
  });
  return { ...harness, trash };
}

const move = (recordKind: string, recordId: string, baseRevision: number) =>
  ({
    baseRevision,
    clientIdempotencyKey: `key-${recordKind}-${recordId}`,
    projectId: PROJECT,
    recordId,
    recordKind,
  }) as never;

describe("Trash seam: GitHub External Record and Test Session", () => {
  test.each([
    ["GitHub External Record", "g1", 0],
    ["Test Session", "ts1", 2],
  ] as const)(
    "moves and restores a %s under the same id",
    async (kind, id, revision) => {
      const { trash } = setup();

      const entry = await trash.move(ACCOUNT, move(kind, id, revision));
      expect(entry).toMatchObject({ recordId: id, recordKind: kind });
      expect(await trash.living(ACCOUNT, PROJECT, [{ id, kind }])).toEqual([]);

      const restored = await trash.restore(ACCOUNT, {
        baseRevision: entry?.revision ?? -1,
        clientIdempotencyKey: `r-${id}`,
        entryId: entry?.id ?? "",
        projectId: PROJECT,
      } as never);
      expect(restored?.records[0]).toMatchObject({
        recordId: id,
        recordKind: kind,
      });
    },
  );

  test("a Session Test never moves to Trash alone", async () => {
    const { trash } = setup();

    await expect(
      trash.move(ACCOUNT, move("Session Test", "st1", 0)),
    ).rejects.toBeInstanceOf(TrashChildRecordError);
  });
});
