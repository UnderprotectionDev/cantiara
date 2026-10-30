import {
  createMemoryExternalSurfaceResponseCache,
  type ExternalSurfaceResponseCache,
} from "@cantiara/api/external-surface-access";
import { REDACTED_VALUE_MARK } from "@cantiara/api/security-redaction";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { document, documentConflictDraft } from "@cantiara/db/schema/document";
import {
  externalSurface,
  externalSurfaceSnapshotRevision,
} from "@cantiara/db/schema/external-surface";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
  mutationTarget,
} from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { createSecurityRedaction } from "../security-redaction";
import {
  createDatabaseSecurityRedactionLocators,
  createDatabaseSecurityRedactionTargets,
  createSurfaceCacheRedactionTarget,
  derivedSearchIndexTarget,
} from "../security-redaction-database";
import { createSecurityRedactionSpread } from "../security-redaction-spread";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

const SECRET = "sk-live-very-secret";
const NOW = new Date("2026-02-01T00:00:00.000Z");

describeDatabase("Security Redaction PostgreSQL stores", () => {
  const connection = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `redaction-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const projectId = `project-${crypto.randomUUID()}`;
  const documentId = `doc-${crypto.randomUUID()}`;
  const surfaceId = `surface-${crypto.randomUUID()}`;
  const historyId = `history-${crypto.randomUUID()}`;
  const cleanHistoryId = `history-${crypto.randomUUID()}`;
  const tokenHash = `token-${crypto.randomUUID()}`;

  function db() {
    if (!connection) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    return connection;
  }

  beforeEach(async () => {
    const database = db();
    await database.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Founder",
    });
    await database
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await database.insert(project).values({
      id: projectId,
      name: "Atlas",
      shortCode: `RD-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      starterConfiguration: "Blank Project",
      workspaceId,
    });
    await database.insert(document).values({
      body: `Deploy with ${SECRET} then verify.`,
      id: documentId,
      projectId,
      revision: 3,
      title: "Deploy",
    });
    await database.insert(documentConflictDraft).values({
      baseRevision: 2,
      body: `draft ${SECRET}`,
      clientIdempotencyKey: "k1",
      documentId,
      id: `draft-${crypto.randomUUID()}`,
      payloadFingerprint: "f",
      projectId,
      title: "Deploy",
      type: "General",
    });
    const actor = {
      actorId: "founder",
      actorType: "User",
      originKind: "human",
      payloadFingerprint: "fp",
    };
    await database.insert(mutationHistory).values([
      {
        ...actor,
        id: historyId,
        nextValue: { body: `Deploy with ${SECRET}` },
        occurredAt: NOW,
        previousValue: { body: "Deploy" },
        revision: 2,
        targetId: documentId,
      },
      {
        ...actor,
        id: cleanHistoryId,
        nextValue: { body: "Deploy" },
        occurredAt: NOW,
        previousValue: { body: "" },
        revision: 1,
        targetId: documentId,
      },
    ]);
    await database.insert(mutationReceipt).values({
      ...actor,
      committedAt: NOW,
      expectedRevision: 1,
      id: `receipt-${crypto.randomUUID()}`,
      idempotencyKey: "i",
      idempotencyScope: `s-${crypto.randomUUID()}`,
      nextValue: { body: SECRET },
      previousValue: {},
      revision: 2,
      targetId: documentId,
    });
    await database.insert(mutationStaging).values({
      ...actor,
      expectedRevision: 2,
      expiresAt: NOW,
      historyId: "h",
      id: `staging-${crypto.randomUUID()}`,
      idempotencyKey: "i",
      idempotencyScope: `s-${crypto.randomUUID()}`,
      payload: { body: SECRET },
      receiptId: "r",
      stagedAt: NOW,
      targetId: documentId,
    });
    await database.insert(mutationTarget).values({
      id: documentId,
      value: { body: SECRET },
    });
    await database.insert(externalSurface).values({
      accessEpoch: 4,
      cancelledAt: NOW,
      id: surfaceId,
      passwordHash: "scrypt$hash",
      projectId,
      tokenHash,
      workspaceId,
    });
    await database.insert(externalSurfaceSnapshotRevision).values({
      id: `snapshot-${crypto.randomUUID()}`,
      revision: 1,
      snapshot: { root: { body: `shared ${SECRET}`, title: "Plan" } },
      surfaceId,
    });
  });

  afterEach(async () => {
    const database = db();
    await database
      .delete(mutationHistory)
      .where(eq(mutationHistory.targetId, documentId));
    await database
      .delete(mutationReceipt)
      .where(eq(mutationReceipt.targetId, documentId));
    await database
      .delete(mutationStaging)
      .where(eq(mutationStaging.targetId, documentId));
    await database
      .delete(mutationTarget)
      .where(eq(mutationTarget.id, documentId));
    await database.delete(user).where(eq(user.id, accountId));
  });

  afterAll(async () => {
    await connection?.$client.end();
  });

  function setup(cache: ExternalSurfaceResponseCache) {
    const database = db();
    return createSecurityRedaction({
      locators: createDatabaseSecurityRedactionLocators(database),
      now: () => NOW,
      projectName: () => Promise.resolve("Atlas"),
      spread: createSecurityRedactionSpread([
        ...createDatabaseSecurityRedactionTargets(database),
        derivedSearchIndexTarget,
        createSurfaceCacheRedactionTarget(database, cache),
      ]),
    });
  }

  const actor = () => ({ accountId, accountName: "Founder" });
  const scope = () => ({ kind: "Project", projectId }) as const;

  test("preview lists the copies and removal clears every store, keeping actor, time and the surface state", async () => {
    const database = db();
    const cache = createMemoryExternalSurfaceResponseCache();
    await cache.set(`${surfaceId}:page`, {
      body: new TextEncoder().encode(SECRET),
      headers: {},
      status: 200,
    });
    const redaction = setup(cache);

    const preview = await redaction.preview(actor(), {
      scope: scope(),
      sensitiveValue: SECRET,
    });
    expect(preview?.locators.map((locator) => locator.kind).sort()).toEqual([
      "current-field",
      "current-field",
      "external-surface-snapshot",
      "history-revision",
      "history-revision",
      "history-revision",
      "history-revision",
    ]);
    expect(JSON.stringify(preview)).not.toContain(SECRET);

    const result = await redaction.apply(
      actor(),
      {
        grant: "g",
        scope: scope(),
        sensitiveValue: SECRET,
        typedName: "Atlas",
      },
      () => Promise.resolve(true),
    );
    expect(result?.removal.targets.map((t) => [t.kind, t.status])).toEqual([
      ["current-field", "removed"],
      ["history-revision", "removed"],
      ["external-surface-snapshot", "removed"],
      ["search-index", "no-stored-copy"],
      ["export-staging", "not-wired"],
      ["cache", "removed"],
    ]);

    const [doc] = await database
      .select()
      .from(document)
      .where(eq(document.id, documentId));
    expect(doc?.body).toBe(`Deploy with ${REDACTED_VALUE_MARK} then verify.`);
    // A stale client holding revision 3 now conflicts instead of restoring the value.
    expect(doc?.revision).toBe(4);
    expect(doc?.trashedAt).toBeNull();
    expect(doc?.archivedAt).toBeNull();

    const everything = JSON.stringify([
      await database.select().from(document).where(eq(document.id, documentId)),
      await database
        .select()
        .from(documentConflictDraft)
        .where(eq(documentConflictDraft.documentId, documentId)),
      await database
        .select()
        .from(mutationHistory)
        .where(eq(mutationHistory.targetId, documentId)),
      await database
        .select()
        .from(mutationReceipt)
        .where(eq(mutationReceipt.targetId, documentId)),
      await database
        .select()
        .from(mutationStaging)
        .where(eq(mutationStaging.targetId, documentId)),
      await database
        .select()
        .from(mutationTarget)
        .where(eq(mutationTarget.id, documentId)),
      await database
        .select()
        .from(externalSurfaceSnapshotRevision)
        .where(eq(externalSurfaceSnapshotRevision.surfaceId, surfaceId)),
    ]);
    expect(everything).not.toContain(SECRET);

    const [history] = await database
      .select()
      .from(mutationHistory)
      .where(eq(mutationHistory.id, historyId));
    expect(history).toMatchObject({
      actorId: "founder",
      actorType: "User",
      occurredAt: NOW,
      revision: 2,
    });
    expect(history?.nextValue).toEqual({
      body: `Deploy with ${REDACTED_VALUE_MARK}`,
    });
    const [clean] = await database
      .select()
      .from(mutationHistory)
      .where(eq(mutationHistory.id, cleanHistoryId));
    expect(clean?.nextValue).toEqual({ body: "Deploy" });

    // The surface stays revoked: no reactivation, no new token, same epoch and password hash.
    const [surface] = await database
      .select()
      .from(externalSurface)
      .where(eq(externalSurface.id, surfaceId));
    expect(surface).toMatchObject({
      accessEpoch: 4,
      cancelledAt: NOW,
      passwordHash: "scrypt$hash",
      tokenHash,
    });
    expect(await cache.get(`${surfaceId}:page`)).toBeNull();

    // Nothing is left to find, and applying again removes nothing.
    const again = await redaction.preview(actor(), {
      scope: scope(),
      sensitiveValue: SECRET,
    });
    expect(again?.locators).toEqual([]);
  });

  test("another Account's content is never touched", async () => {
    const database = db();
    const otherAccount = `other-${crypto.randomUUID()}`;
    const otherWorkspace = `workspace-${crypto.randomUUID()}`;
    const otherDocument = `doc-${crypto.randomUUID()}`;
    await database.insert(user).values({
      email: `${otherAccount}@example.invalid`,
      id: otherAccount,
      name: "Other",
    });
    await database
      .insert(workspace)
      .values({ id: otherWorkspace, ownerAccountId: otherAccount });
    await database.insert(document).values({
      body: `same ${SECRET}`,
      id: otherDocument,
      title: "Other",
      workspaceId: otherWorkspace,
    });
    try {
      await setup(createMemoryExternalSurfaceResponseCache()).apply(
        actor(),
        {
          grant: "g",
          scope: { kind: "Account" },
          sensitiveValue: SECRET,
          typedName: "Founder",
        },
        () => Promise.resolve(true),
      );
      const [other] = await database
        .select()
        .from(document)
        .where(eq(document.id, otherDocument));
      expect(other?.body).toBe(`same ${SECRET}`);
    } finally {
      await database.delete(user).where(eq(user.id, otherAccount));
    }
  });
});
