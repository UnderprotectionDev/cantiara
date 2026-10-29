import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

import { createTrash } from "../trash";
import { createTrashEarlyDelete } from "../trash-early-delete";
import { createMemoryTrash } from "../trash-memory-store";

const ACCOUNT = "account-1";
const TRASH_PROCEDURE = /trash/i;
const DELETE_PROCEDURE =
  /^(delete|purge|permanently).*trash|trash.*(purge|permanent)/i;

function setup(authenticated = true) {
  const harness = createMemoryTrash({
    accountId: ACCOUNT,
    projects: new Map([
      [
        "project-1",
        {
          records: new Map([["Risk:r1", { label: "Slip", revision: 2 }]]),
          workspaceId: "workspace-1",
        },
      ],
    ]),
  });
  const context = {
    session: authenticated
      ? { session: { id: "session" }, user: { id: ACCOUNT } }
      : null,
    trash: createTrash(harness.store),
  } as unknown as Context;
  return createRouterClient(appRouter, { context });
}

const body = {
  baseRevision: 2,
  clientIdempotencyKey: "key-1",
  projectId: "project-1",
  recordId: "r1",
  recordKind: "Risk" as const,
};

describe("Trash RPC seam", () => {
  test("exposes list, Move to Trash, Restore and the early Permanently Delete pair", () => {
    const procedures = Object.keys(appRouter).filter((name) =>
      TRASH_PROCEDURE.test(name),
    );

    expect(procedures).toContain("moveToTrash");
    expect(procedures).toContain("trash");
    expect(procedures).toContain("restoreFromTrash");
    expect(procedures.filter((name) => DELETE_PROCEDURE.test(name))).toEqual([
      "permanentlyDeleteFromTrash",
    ]);
    expect(procedures).toContain("previewPermanentDeleteFromTrash");
  });

  test("moves a record and lists it with the 30-day window", async () => {
    const client = setup();

    const entry = await client.moveToTrash(body);
    const overview = await client.trash({ projectId: "project-1" });

    expect(entry.recordId).toBe("r1");
    expect(overview.retentionDays).toBe(30);
    expect(overview.entries.map((e) => e.id)).toEqual([entry.id]);
  });

  test("previews the attached surfaces with revoke as the default", async () => {
    const client = setup();

    const preview = await client.moveToTrashPreview({
      projectId: "project-1",
      recordId: "r1",
      recordKind: "Risk",
    });

    expect(preview.defaultDisposition).toBe("revoke");
    expect(preview.surfaces).toEqual([]);
    expect(preview.keepApprovedSurface.available).toBe(false);
  });

  test("restores a record with the same id and answers a stale revision", async () => {
    const client = setup();
    const entry = await client.moveToTrash(body);

    await expect(
      client.restoreFromTrash({
        baseRevision: entry.revision - 1,
        clientIdempotencyKey: "r-stale",
        entryId: entry.id,
        projectId: "project-1",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const restored = await client.restoreFromTrash({
      baseRevision: entry.revision,
      clientIdempotencyKey: "r-1",
      entryId: entry.id,
      projectId: "project-1",
    });

    expect(restored.records).toEqual([
      { recordId: "r1", recordKind: "Risk", revision: 4 },
    ]);
    expect((await client.trash({ projectId: "project-1" })).entries).toEqual(
      [],
    );
    await expect(
      client.restoreFromTrash({
        baseRevision: entry.revision,
        clientIdempotencyKey: "r-2",
        entryId: entry.id,
        projectId: "project-1",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("a surface disposition other than revoke or keep is a bad request", async () => {
    const client = setup();

    await expect(
      client.moveToTrash({ ...body, surfaceDisposition: "publish" as never }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("replays the same key with the same entry", async () => {
    const client = setup();

    const first = await client.moveToTrash(body);
    const again = await client.moveToTrash(body);

    expect(again).toEqual(first);
  });

  test("answers a stale base revision with a precondition failure", async () => {
    const client = setup();

    await expect(
      client.moveToTrash({ ...body, baseRevision: 1 }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("rejects a child Session Test as a bad request", async () => {
    const client = setup();

    await expect(
      client.moveToTrash({
        ...body,
        recordId: "st1",
        recordKind: "Session Test",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("does not find another account's Project and rejects anonymous calls", async () => {
    await expect(setup().trash({ projectId: "missing" })).rejects.toMatchObject(
      { code: "NOT_FOUND" },
    );
    await expect(
      setup(false).trash({ projectId: "project-1" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("early Permanently Delete consumes the early-permanent-delete grant once and fails closed", async () => {
    const harness = createMemoryTrash({
      accountId: ACCOUNT,
      projects: new Map([
        [
          "project-1",
          {
            records: new Map([["Risk:r1", { label: "Slip", revision: 2 }]]),
            workspaceId: "workspace-1",
          },
        ],
      ]),
    });
    const consume = vi.fn(() => Promise.resolve(false));
    const context = {
      githubIdentityConfirmation: { consume },
      session: { session: { id: "session" }, user: { id: ACCOUNT } },
      trash: {
        ...createTrash(harness.store),
        earlyDelete: createTrashEarlyDelete({
          events: harness.eventLog,
          expiry: harness.expiry,
          projectName: () => Promise.resolve("Atlas"),
          store: harness.store,
        }),
      },
    } as unknown as Context;
    const client = createRouterClient(appRouter, { context });
    const entry = await client.moveToTrash(body);
    const request = {
      baseRevision: entry.revision,
      clientIdempotencyKey: "del-1",
      entryId: entry.id,
      grant: "g",
      projectId: "project-1",
      typedName: "Atlas",
    };

    await expect(
      client.permanentlyDeleteFromTrash(request),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      client.permanentlyDeleteFromTrash({ ...request, typedName: "nope" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(consume).toHaveBeenCalledTimes(1);
    expect(consume).toHaveBeenCalledWith(
      { accountId: ACCOUNT, sessionId: "session" },
      "early-permanent-delete",
      "g",
      undefined,
    );
    expect(harness.events).toHaveLength(0);

    consume.mockResolvedValueOnce(true);
    const result = await client.permanentlyDeleteFromTrash(request);
    expect(result.records).toEqual([{ recordId: "r1", recordKind: "Risk" }]);
  });
});
