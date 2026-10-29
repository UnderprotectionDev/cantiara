import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { risk } from "@cantiara/db/schema/risk";
import { trashEntry } from "@cantiara/db/schema/trash";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createDatabaseProjectShell } from "../../../project-shell/server/project-shell-database";
import type { StoredTrashEntry } from "../trash";
import { createDatabaseTrash } from "../trash-database";
import { trashPermanentDeleteEvent } from "../trash-expiry";
import { createDatabaseTrashExpiry } from "../trash-expiry-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Trash PostgreSQL", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `trash-${crypto.randomUUID()}`;

  beforeEach(async () => {
    await database?.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Founder",
    });
    await database?.insert(workspace).values({
      id: `workspace-${crypto.randomUUID()}`,
      ownerAccountId: accountId,
    });
  });
  afterEach(async () => {
    await database?.delete(user).where(eq(user.id, accountId));
  });
  afterAll(async () => {
    await database?.$client.end();
  });

  test("moves a Risk keeping its row and id, replays the key and rejects a stale revision", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const profile = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Trash",
        shortCode: "TRS",
        starterConfiguration: "Blank Project",
      },
    );
    const riskId = `risk-${crypto.randomUUID()}`;
    await database
      .insert(risk)
      .values({ id: riskId, projectId: profile.id, title: "Slip" });
    const trash = createDatabaseTrash(database);
    const input = {
      baseRevision: 0,
      clientIdempotencyKey: `key-${crypto.randomUUID()}`,
      projectId: profile.id,
      recordId: riskId,
      recordKind: "Risk" as const,
    };

    const entry = await trash.move(accountId, input);
    const again = await trash.move(accountId, input);

    expect(again).toEqual(entry);
    const [row] = await database.select().from(risk).where(eq(risk.id, riskId));
    expect(row).toMatchObject({ id: riskId, revision: 1 });
    expect(row?.trashedAt).not.toBeNull();
    expect(
      (await trash.overview(accountId, profile.id))?.entries.map(
        (e) => e.recordId,
      ),
    ).toEqual([riskId]);
    expect(
      await trash.living(accountId, profile.id, [{ id: riskId, kind: "Risk" }]),
    ).toEqual([]);
    await expect(
      trash.move(accountId, {
        ...input,
        baseRevision: 0,
        clientIdempotencyKey: `key-${crypto.randomUUID()}`,
      }),
    ).rejects.toMatchObject({ code: "TRASH_ALREADY_TRASHED" });
  });

  test("expiry erase refuses a record that left Trash and writes nothing", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const profile = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Trash",
        shortCode: "TRX",
        starterConfiguration: "Blank Project",
      },
    );
    const [ws] = await database
      .select({ id: workspace.id })
      .from(workspace)
      .where(eq(workspace.ownerAccountId, accountId))
      .limit(1);
    if (!ws) {
      throw new Error("workspace is required");
    }
    const riskId = `risk-${crypto.randomUUID()}`;
    // The record row has no trashed stamp: the restore side of the race won.
    await database
      .insert(risk)
      .values({ id: riskId, projectId: profile.id, title: "Slip" });
    const trashedAt = new Date();
    const entryId = `entry-${crypto.randomUUID()}`;
    const stored = {
      id: entryId,
      projectId: profile.id,
      recordId: riskId,
      recordKind: "Risk",
      trashedAt,
    } as const;
    await database.insert(trashEntry).values({
      actorAccountId: accountId,
      baseRevision: 0,
      expiresAt: new Date(trashedAt.valueOf() + 720 * 60 * 60 * 1000),
      id: entryId,
      idempotencyKey: `key-${crypto.randomUUID()}`,
      idempotencyScope: "test-scope",
      payloadFingerprint: "test-fingerprint",
      projectId: profile.id,
      recordId: riskId,
      recordKind: "Risk",
      recordLabel: "Slip",
      trashedAt,
      workspaceId: ws.id,
    });
    const expiry = createDatabaseTrashExpiry(database);
    // erase reads the unit through its ids and kind/id stamps (content-free).
    const unit = [stored as unknown as StoredTrashEntry];
    const unitEvent = trashPermanentDeleteEvent(
      stored as unknown as StoredTrashEntry,
      "test:actor",
      trashedAt,
    );

    expect(await expiry.erase(unit, [unitEvent])).toBe(false);

    const [kept] = await database
      .select()
      .from(risk)
      .where(eq(risk.id, riskId));
    expect(kept).toMatchObject({ id: riskId, revision: 0 });
    expect(kept?.trashedAt).toBeNull();
    const [liveEntry] = await database
      .select()
      .from(trashEntry)
      .where(eq(trashEntry.id, entryId));
    expect(liveEntry).toMatchObject({ id: entryId });

    // The same unit erases once the record is stamped again; appending the
    // security event stays the caller's job (eraseAndRecord).
    await database
      .update(risk)
      .set({ revision: 1, trashedAt })
      .where(eq(risk.id, riskId));
    expect(await expiry.erase(unit, [unitEvent])).toBe(true);
    expect(
      await database.select().from(risk).where(eq(risk.id, riskId)),
    ).toEqual([]);
    expect(
      await database
        .select()
        .from(trashEntry)
        .where(eq(trashEntry.id, entryId)),
    ).toEqual([]);
  });
});
