import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import { createDataImport } from "../data-import";
import { createMemoryDataImport } from "./data-import-memory-store";

const ACCOUNT = "account-1";
const IMPORT_PROCEDURE = /import/i;
const RESTORE_PROCEDURE = /restore|zip|folder|workspace/i;

function setup(authenticated = true) {
  const harness = createMemoryDataImport({ accountId: ACCOUNT });
  const context = {
    dataImport: createDataImport(harness.ports),
    session: authenticated
      ? { session: { id: "session" }, user: { id: ACCOUNT } }
      : null,
  } as unknown as Context;
  return { ...harness, client: createRouterClient(appRouter, { context }) };
}

const scope = { kind: "project", projectId: "project-1" } as const;

describe("Standard Import RPC seam", () => {
  test("exposes preview, Apply Import, cancel and receipt reopen, and no restore path", () => {
    const procedures = Object.keys(appRouter).filter((name) =>
      IMPORT_PROCEDURE.test(name),
    );

    expect(procedures.sort()).toEqual([
      "applyImport",
      "cancelImport",
      "previewImport",
      "reopenImportPreview",
      "reopenImportReceipt",
    ]);
    expect(procedures.some((name) => RESTORE_PROCEDURE.test(name))).toBe(false);
  });

  test("applies once, replays the receipt, and answers a changed set as CONFLICT", async () => {
    const { client, written } = setup();
    const preview = await client.previewImport({
      catalogType: "Task",
      content: "Title\nWrite brief",
      fileName: "tasks.csv",
      scope,
    });
    const confirm = {
      finalSetFingerprint: preview.finalSetFingerprint,
      idempotencyKey: "rpc-key-00001",
      stagingId: preview.stagingId,
    };

    const first = await client.applyImport(confirm);
    const replay = await client.applyImport(confirm);
    const reopened = await client.reopenImportReceipt({
      idempotencyKey: "rpc-key-00001",
    });

    expect(first).toMatchObject({ replayed: false, status: "committed" });
    expect(replay).toMatchObject({ replayed: true, status: "committed" });
    expect(reopened).toMatchObject({ counts: { created: 1 } });
    expect(written.records).toHaveLength(1);
    const other = await client.previewImport({
      catalogType: "Task",
      content: "Title\nSomething else",
      fileName: "tasks.csv",
      scope,
    });
    await expect(
      client.applyImport({
        ...confirm,
        finalSetFingerprint: other.finalSetFingerprint,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("answers an Apply refusal with a stable code and cancel with its status", async () => {
    const { client, written } = setup();
    const preview = await client.previewImport({
      catalogType: "Task",
      content: "Title,Note\nValid,a\n,b",
      fileName: "tasks.csv",
      scope,
    });

    await expect(
      client.applyImport({
        finalSetFingerprint: preview.finalSetFingerprint,
        idempotencyKey: "rpc-key-00002",
        stagingId: preview.stagingId,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { code: "invalid-rows-remain" },
    });
    await expect(
      client.cancelImport({ stagingId: preview.stagingId }),
    ).resolves.toEqual({ status: "cancelled" });
    expect(written.records).toHaveLength(0);
  });

  test("previews a CSV file and reopens it from staging", async () => {
    const { client, primaryUnchanged } = setup();

    const preview = await client.previewImport({
      catalogType: "Risk",
      content: "title\nSlip",
      fileName: "risks.csv",
      scope,
    });
    const reopened = await client.reopenImportPreview({
      stagingId: preview.stagingId,
    });

    expect(preview.primaryWrites).toBe("none");
    expect(reopened).toEqual(preview);
    expect(primaryUnchanged()).toBe(true);
  });

  test("answers a refusal with a stable code and a missing scope as not found", async () => {
    const { client } = setup();

    await expect(
      client.previewImport({
        content: "x",
        fileName: "all.zip",
        scope,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { code: "unsupported-package" },
    });
    await expect(
      client.previewImport({
        catalogType: "Risk",
        content: "title\nA",
        fileName: "r.csv",
        scope: { kind: "project", projectId: "other" },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("requires a signed-in session", async () => {
    const { client } = setup(false);

    await expect(
      client.previewImport({ content: "x", fileName: "a.md", scope }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
