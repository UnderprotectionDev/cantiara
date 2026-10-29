import {
  MutationConflictError,
  MutationStaleBaseRevisionError,
} from "@cantiara/api/mutation-contract";
import {
  KEEP_APPROVED_SURFACE_LABEL,
  TRASH_RECORD_KINDS,
  TRASH_RETENTION_DAYS,
  TrashAlreadyTrashedError,
  TrashChildRecordError,
  TrashKeepSurfaceNotAllowedError,
  type TrashSurface,
  TrashSurfaceNotRevokedError,
} from "@cantiara/api/trash";
import { describe, expect, test } from "vitest";

import { createTrash, type TrashSurfacePort } from "../trash";
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
      "External Surface",
      "Custom Field",
      "Smart Collection",
      "Automation Rule",
      "Work Template",
      "Document Template",
      "Record Action",
      "Prioritization Session",
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

function withSurfaces(initial: TrashSurface[]) {
  const surfaces = new Map(initial.map((s) => [s.surfaceId, { ...s }]));
  const calls: string[] = [];
  const port: TrashSurfacePort = {
    attached: () => Promise.resolve([...surfaces.values()]),
    freeze: (_account, surface) => {
      const found = surfaces.get(surface.surfaceId);
      if (found?.state !== "Active") {
        return Promise.resolve(false);
      }
      found.state = "Kept";
      calls.push(`freeze:${surface.surfaceId}`);
      return Promise.resolve(true);
    },
    revoke: (_account, surface) => {
      const found = surfaces.get(surface.surfaceId);
      if (found) {
        found.state = "Revoked";
      }
      calls.push(`revoke:${surface.surfaceId}`);
      return Promise.resolve();
    },
  };
  return { calls, port, surfaces };
}

const share = (surfaceId: string, state: TrashSurface["state"] = "Active") =>
  ({ kind: "Link-limited share", state, surfaceId }) as TrashSurface;

function setupSurfaces(initial: TrashSurface[]) {
  const harness = createMemoryTrash({
    accountId: ACCOUNT,
    projects: new Map([
      [
        PROJECT,
        {
          records: new Map([
            ["Document:d1", { label: "Notes", revision: 0 }],
            ["Work:w1", { label: "Ship it", revision: 3 }],
            [
              "External Surface:rev",
              { label: "Link-limited share", movable: true, revision: 0 },
            ],
            [
              "External Surface:live",
              { label: "Link-limited share", movable: false, revision: 0 },
            ],
          ]),
          workspaceId: "workspace-1",
        },
      ],
    ]),
  });
  const fake = withSurfaces(initial);
  return {
    ...harness,
    ...fake,
    trash: createTrash(harness.store, { now: () => NOW, surfaces: fake.port }),
  };
}

const preview = (recordKind: string, recordId: string) =>
  ({ projectId: PROJECT, recordId, recordKind }) as never;

describe("Trash seam: External Surface preview and default revoke", () => {
  test("the preview lists every attached surface and defaults to revoke", async () => {
    const { trash } = setupSurfaces([
      share("s1"),
      share("s2", "Revoked"),
      share("s3", "Kept"),
    ]);

    const result = await trash.preview(ACCOUNT, preview("Document", "d1"));

    expect(result?.defaultDisposition).toBe("revoke");
    expect(result?.surfaces.map((s) => [s.surfaceId, s.state])).toEqual([
      ["s1", "Active"],
      ["s2", "Revoked"],
      ["s3", "Kept"],
    ]);
    expect(result?.keepApprovedSurface).toEqual({ available: true });
  });

  test("moving without a choice revokes every Active surface and leaves others", async () => {
    const { calls, surfaces, trash } = setupSurfaces([
      share("s1"),
      share("s2", "Revoked"),
      share("s3", "Kept"),
    ]);

    const entry = await trash.move(ACCOUNT, move("Document", "d1", 0));

    expect(calls).toEqual(["revoke:s1"]);
    expect(surfaces.get("s1")?.state).toBe("Revoked");
    expect(surfaces.get("s3")?.state).toBe("Kept");
    expect(entry?.surfaces).toEqual([
      { disposition: "revoked", surfaceId: "s1" },
    ]);
  });

  test("a stale move revokes nothing", async () => {
    const { calls, trash } = setupSurfaces([share("s1")]);

    await expect(
      trash.move(ACCOUNT, move("Document", "d1", 9)),
    ).rejects.toMatchObject({ code: "STALE_BASE_REVISION" });
    expect(calls).toEqual([]);
  });

  test("another account gets no preview", async () => {
    const { trash } = setupSurfaces([share("s1")]);

    expect(await trash.preview("other", preview("Document", "d1"))).toBeNull();
    expect(
      await trash.preview(ACCOUNT, preview("Document", "missing")),
    ).toBeNull();
  });
});

const NON_RECORD_DELETIONS = [
  "project",
  "project-delete-group",
  "workspace",
  "account",
] as const;

describe("Trash seam: Keep approved surface", () => {
  const keep = (recordKind: string, recordId: string, baseRevision: number) =>
    ({
      ...(move(recordKind, recordId, baseRevision, "keep-key") as object),
      surfaceDisposition: "keep",
    }) as never;

  test.each(NON_RECORD_DELETIONS)(
    "is absent from the preview of a %s delete",
    async (deletion) => {
      const { trash } = setupSurfaces([share("s1")]);

      const result = await trash.preview(ACCOUNT, preview("Document", "d1"), {
        deletion,
      });

      expect(result?.keepApprovedSurface.available).toBe(false);
      expect(result?.surfaces).toHaveLength(1);
    },
  );

  test("a single record delete offers it only with an Active surface", async () => {
    const { trash } = setupSurfaces([share("s2", "Revoked")]);

    const result = await trash.preview(ACCOUNT, preview("Document", "d1"));

    expect(result?.keepApprovedSurface.available).toBe(false);
  });

  test("keeping freezes the surface instead of revoking it", async () => {
    const { calls, surfaces, trash } = setupSurfaces([share("s1")]);

    const entry = await trash.move(ACCOUNT, keep("Document", "d1", 0));

    expect(calls).toEqual(["freeze:s1"]);
    expect(surfaces.get("s1")?.state).toBe("Kept");
    expect(entry?.surfaces).toEqual([{ disposition: "kept", surfaceId: "s1" }]);
  });

  test("a surface that cannot freeze is revoked, never left live", async () => {
    const { calls, port, surfaces, trash } = setupSurfaces([share("s1")]);
    port.freeze = () => Promise.resolve(false);

    const entry = await trash.move(ACCOUNT, keep("Document", "d1", 0));

    expect(calls).toEqual(["revoke:s1"]);
    expect(surfaces.get("s1")?.state).toBe("Revoked");
    expect(entry?.surfaces?.[0]?.disposition).toBe("revoked");
  });

  test.each(NON_RECORD_DELETIONS)(
    "a keep request on a %s delete is rejected and writes nothing",
    async (deletion) => {
      const { calls, entries, surfaces, trash } = setupSurfaces([share("s1")]);

      await expect(
        trash.move(ACCOUNT, keep("Document", "d1", 0), { deletion }),
      ).rejects.toBeInstanceOf(TrashKeepSurfaceNotAllowedError);
      expect(calls).toEqual([]);
      expect(entries).toHaveLength(0);
      expect(surfaces.get("s1")?.state).toBe("Active");
    },
  );

  test("the rejection names the Keep approved surface label", async () => {
    const { trash } = setupSurfaces([share("s1")]);

    await expect(
      trash.move(ACCOUNT, keep("Document", "d1", 0), { deletion: "project" }),
    ).rejects.toThrow(KEEP_APPROVED_SURFACE_LABEL);
  });

  test("the surface port has no bind path, so restore cannot auto-bind", () => {
    const { port } = withSurfaces([share("s1")]);

    expect(Object.keys(port).sort()).toEqual(["attached", "freeze", "revoke"]);
  });
});

describe("Trash seam: a revoked External Surface in Trash", () => {
  test("a revoked surface moves to Trash on the same 30-day clock", async () => {
    const { trash } = setupSurfaces([]);

    const entry = await trash.move(ACCOUNT, move("External Surface", "rev", 0));

    expect(entry).toMatchObject({
      recordId: "rev",
      recordKind: "External Surface",
    });
    expect(entry?.expiresAt).toBe(
      new Date(NOW.valueOf() + 30 * DAY_MS).toISOString(),
    );
  });

  test("an Active surface cannot enter Trash before it is revoked", async () => {
    const { entries, trash } = setupSurfaces([]);

    await expect(
      trash.move(ACCOUNT, move("External Surface", "live", 0)),
    ).rejects.toBeInstanceOf(TrashSurfaceNotRevokedError);
    expect(entries).toHaveLength(0);
  });
});
