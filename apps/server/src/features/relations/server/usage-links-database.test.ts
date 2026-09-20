import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import {
  createDatabaseUsageLinkMutationContracts,
  createDatabaseUsageLinks,
} from "./usage-links-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Usage Links PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `usage-links-${crypto.randomUUID()}`;
  const otherAccountId = `usage-links-other-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;

  const source = { recordId: "work-1", recordType: "Work" } as const;
  const surface = { recordId: "document-1", recordType: "Document" } as const;
  const payload = {
    kind: "Live block",
    location: { blockId: "block-1" },
    source,
    surface,
  } as const;

  beforeEach(async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(user).values([
      {
        email: `${accountId}@example.invalid`,
        id: accountId,
        name: "Founder",
      },
      {
        email: `${otherAccountId}@example.invalid`,
        id: otherAccountId,
        name: "Other",
      },
    ]);
    await database
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
  });

  afterEach(async () => {
    await database?.delete(user).where(eq(user.id, accountId));
    await database?.delete(user).where(eq(user.id, otherAccountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("keeps usage links scoped to the owning Workspace", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const usageLinks = createDatabaseUsageLinks(database);

    const link = await usageLinks.create(accountId, payload);
    await expect(usageLinks.listBySource(accountId, source)).resolves.toEqual([
      link,
    ]);
    await expect(
      usageLinks.listBySource(otherAccountId, source),
    ).resolves.toEqual([]);
    await expect(usageLinks.find(otherAccountId, link.id)).resolves.toBeNull();
    await expect(usageLinks.unlink(otherAccountId, link.id)).resolves.toBe(
      false,
    );

    await expect(usageLinks.unlink(accountId, link.id)).resolves.toBe(true);
    await expect(usageLinks.listBySource(accountId, source)).resolves.toEqual(
      [],
    );
  });

  test("creates and unlinks through the Mutation Contract", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const contracts = createDatabaseUsageLinkMutationContracts(database);
    const create = contracts.create(accountId);
    const clientIdempotencyKey = `create-usage-${crypto.randomUUID()}`;
    const command = {
      actor: { actorId: accountId, type: "User" },
      baseRevision: 0,
      clientIdempotencyKey,
      kind: "human",
      payload,
      targetId: clientIdempotencyKey,
    } as const;

    const receipt = await create.mutate(
      command,
      ({ currentRevision, payload: mutationPayload }) => ({
        usageLink: {
          createdAt: new Date().toISOString(),
          id: crypto.randomUUID(),
          ...mutationPayload,
          revision: currentRevision + 1,
        },
      }),
    );
    const created = receipt.nextValue.usageLink;
    if (!created) {
      throw new Error("Usage link was not created.");
    }

    // Same key and payload replays the durable receipt instead of a second row.
    await expect(
      create.mutate(command, () => ({ usageLink: created })),
    ).resolves.toMatchObject({
      id: receipt.id,
      nextValue: { usageLink: { id: created.id } },
    });

    const unlink = contracts.unlink(accountId);
    await expect(
      unlink.mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: created.revision + 1,
          clientIdempotencyKey: `unlink-stale-${crypto.randomUUID()}`,
          kind: "human",
          payload: {},
          targetId: created.id,
        },
        () => ({ usageLink: null }),
      ),
    ).rejects.toMatchObject({
      code: "STALE_BASE_REVISION",
      currentRevision: created.revision,
    });

    await expect(
      unlink.mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: created.revision,
          clientIdempotencyKey: `unlink-${crypto.randomUUID()}`,
          kind: "human",
          payload: {},
          targetId: created.id,
        },
        () => ({ usageLink: null }),
      ),
    ).resolves.toMatchObject({ nextValue: { usageLink: null } });
  });
});
