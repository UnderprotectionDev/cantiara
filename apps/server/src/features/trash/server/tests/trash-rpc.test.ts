import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import { createTrash } from "../trash";
import { createMemoryTrash } from "../trash-memory-store";

const ACCOUNT = "account-1";
const TRASH_PROCEDURE = /trash/i;
const RESTORE_OR_DELETE_PROCEDURE =
  /^(restore|delete|purge|permanently).*trash|trash.*(restore|purge|permanent)/i;

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
  test("exposes list and Move to Trash only, no restore or delete yet", () => {
    const procedures = Object.keys(appRouter).filter((name) =>
      TRASH_PROCEDURE.test(name),
    );

    expect(procedures).toContain("moveToTrash");
    expect(procedures).toContain("trash");
    expect(
      procedures.filter((name) => RESTORE_OR_DELETE_PROCEDURE.test(name)),
    ).toEqual([]);
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
});
