import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { risk } from "@cantiara/db/schema/risk";
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
import { createDatabaseTrash } from "../trash-database";

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
});
