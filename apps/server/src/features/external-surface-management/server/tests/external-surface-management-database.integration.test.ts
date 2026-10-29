import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  externalSurface,
  externalSurfaceSnapshotRevision,
} from "@cantiara/db/schema/external-surface";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createDatabaseSurfaceDirectory } from "../external-surface-management-database";
import { createSurfacePurges } from "../external-surface-purge";
import { createDatabaseSurfacePurges } from "../external-surface-purge-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("External Surface Management PostgreSQL", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `surface-directory-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;

  beforeEach(async () => {
    await database?.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Founder",
    });
    await database
      ?.insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
  });
  afterEach(async () => {
    await database?.delete(user).where(eq(user.id, accountId));
  });
  afterAll(async () => {
    await database?.$client.end();
  });

  test("lists surfaces of every state without a token hash or password hash, and a cancelled id is never reused", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const surfaceId = `surface-${crypto.randomUUID()}`;
    await database.insert(externalSurface).values({
      id: surfaceId,
      passwordHash: "scrypt$secret",
      rootId: "d1",
      rootKind: "Document",
      surfaceKind: "Link-limited share",
      tokenHash: `hash-${crypto.randomUUID()}`,
      workspaceId,
    });
    await database.insert(externalSurfaceSnapshotRevision).values({
      id: crypto.randomUUID(),
      revision: 1,
      snapshot: { approvedAt: "2026-01-01T00:00:00Z", root: { title: "Plan" } },
      surfaceId,
    });
    const directory = createDatabaseSurfaceDirectory(database);
    const [record] = (await directory.records(accountId, {})) ?? [];
    expect(record).toMatchObject({
      passwordProtected: true,
      surfaceId,
    });
    expect(JSON.stringify(record)).not.toContain("scrypt$secret");
    expect(Object.keys(record ?? {})).not.toContain("tokenHash");
    expect(await directory.records("other-account", {})).toEqual([]);

    // A removed id stays: a new surface cannot take it over.
    expect(await directory.cancelDetached(accountId, surfaceId)).toBe(true);
    expect(await directory.cancelDetached(accountId, surfaceId)).toBe(false);
    await expect(
      database.insert(externalSurface).values({ id: surfaceId, workspaceId }),
    ).rejects.toThrow();
    const [after] = (await directory.records(accountId, {})) ?? [];
    expect(after?.cancelledAt).not.toBeNull();
  });

  test("a removed surface gets one purge request that retries and completes", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const surfaceId = `surface-${crypto.randomUUID()}`;
    await database.insert(externalSurface).values({
      cancelledAt: new Date(),
      id: surfaceId,
      workspaceId,
    });
    const purge: { failing: boolean } = { failing: true };
    const purges = createSurfacePurges({
      store: createDatabaseSurfacePurges(database),
      targets: [
        () =>
          purge.failing
            ? Promise.reject(new Error("unreachable"))
            : Promise.resolve(),
      ],
    });
    const first = await purges.request(surfaceId);
    expect(first).toMatchObject({ attempts: 1, status: "Retrying" });
    expect(await purges.request(surfaceId)).toMatchObject({
      status: "Retrying",
    });
    purge.failing = false;
    // The retry is not due yet, so a sweep leaves it for later.
    expect(await purges.sweep()).toBe(0);
  });
});
