import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { usageLink, workRelation } from "@cantiara/db/schema/relation";
import { createRouterClient } from "@orpc/server";
import { and, eq, or } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createDatabaseSourcesAndFreshness } from "./sources-database";

const url = process.env.ACCOUNT_ACCESS_DATABASE_URL;
(url ? describe : describe.skip)("Sources and Freshness", () => {
  const db = url ? createDb({ DATABASE_URL: url }) : undefined;
  const accountId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const workspaceId = crypto.randomUUID();
  beforeAll(async () => {
    if (!db) {
      throw new Error("Database required");
    }
    await db.insert(user).values({
      id: accountId,
      name: "Founder",
      email: `${accountId}@example.invalid`,
    });
    await db
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await db.insert(project).values({
      id: projectId,
      workspaceId,
      name: "Source research",
      shortCode: `S${accountId.slice(0, 6).toUpperCase()}`,
      starterConfiguration: "Blank Project",
    });
  });
  afterAll(async () => {
    await db?.delete(user).where(eq(user.id, accountId));
    await db?.$client.end();
  });
  test("keeps the first dated capture after explicitly saving a new Source version", async () => {
    if (!db) {
      throw new Error("Database required");
    }
    const sources = createDatabaseSourcesAndFreshness(db);
    const id = crypto.randomUUID();
    const saved = await sources.create(accountId, {
      id,
      projectId,
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
      url: "HTTPS://example.org/research",
      title: "Original research",
      accessedAt: "2026-10-01T09:00:00.000Z",
      capturedContent: "  Original finding.\n",
    });
    expect(saved).toMatchObject({
      id,
      projectId,
      sourceType: "Source",
      revision: 1,
    });
    const next = await sources.saveVersion(accountId, {
      sourceId: id,
      projectId,
      baseRevision: 1,
      clientIdempotencyKey: crypto.randomUUID(),
      url: "HtTpS://example.org/research/revised",
      title: "Revised research",
      accessedAt: "2026-10-10T09:00:00.000Z",
      capturedContent: "Revised finding.",
      provider: "Research portal",
      externalRecordType: "Article",
      externalId: "article-42",
    });
    expect(next).toMatchObject({ id, revision: 2 });
    const reopened = await createDatabaseSourcesAndFreshness(db).find(
      accountId,
      { sourceId: id, projectId },
    );
    expect(reopened?.versions).toMatchObject([
      {
        revision: 1,
        url: "https://example.org/research",
        title: "Original research",
        accessedAt: "2026-10-01T09:00:00.000Z",
        capturedContent: "  Original finding.\n",
        provider: null,
      },
      {
        revision: 2,
        url: "https://example.org/research/revised",
        title: "Revised research",
        accessedAt: "2026-10-10T09:00:00.000Z",
        capturedContent: "Revised finding.",
        provider: "Research portal",
        externalRecordType: "Article",
        externalId: "article-42",
      },
    ]);
    expect((await sources.list(accountId, projectId))?.records).toContainEqual(
      next,
    );
    // Observe the separate Relations counterpart: Source presence writes no binds.
    expect(
      await db
        .select()
        .from(workRelation)
        .where(
          or(
            eq(workRelation.sourceWorkId, id),
            eq(workRelation.targetRecordId, id),
          ),
        ),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(usageLink)
        .where(
          or(
            eq(usageLink.sourceRecordId, id),
            eq(usageLink.surfaceRecordId, id),
          ),
        ),
    ).toEqual([]);
  });
  test("exposes Source saves through authenticated RPC and refuses anonymous reads and writes", async () => {
    if (!db) {
      throw new Error("Database required");
    }
    const sourcesAndFreshness = createDatabaseSourcesAndFreshness(db);
    const context = {
      db,
      sourcesAndFreshness,
      session: { session: { id: "session-1" }, user: { id: accountId } },
    } as Context;
    const client = createRouterClient(appRouter, { context });
    const input = {
      id: crypto.randomUUID(),
      projectId,
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
      url: "HTTPS://example.org/rpc",
      title: "RPC research",
      accessedAt: "2026-10-10T10:00:00.000Z",
      capturedContent: "RPC excerpt",
    };
    expect(await client.createSource(input)).toMatchObject({
      sourceType: "Source",
      revision: 1,
      version: { url: "https://example.org/rpc" },
    });
    expect(
      await client.source({ sourceId: input.id, projectId }),
    ).toMatchObject({ record: { id: input.id } });
    expect(
      (await client.projectSources({ projectId }))?.records.map(
        (record) => record.id,
      ),
    ).toContain(input.id);
    const { id, ...capture } = input;
    const newVersion = {
      ...capture,
      sourceId: id,
      baseRevision: 1,
      clientIdempotencyKey: crypto.randomUUID(),
      capturedContent: "New RPC excerpt",
    };
    expect(await client.saveSourceVersion(newVersion)).toMatchObject({
      id,
      revision: 2,
      version: { capturedContent: "New RPC excerpt" },
    });
    await expect(
      client.saveSourceVersion({
        ...newVersion,
        clientIdempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      data: { targetId: id },
    });
    const anonymous = createRouterClient(appRouter, {
      context: { ...context, session: null },
    });
    await expect(anonymous.createSource(input)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      anonymous.source({ sourceId: input.id, projectId }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymous.saveSourceVersion(newVersion)).rejects.toMatchObject(
      { code: "UNAUTHORIZED" },
    );
  });
  test("retries a committed capture once and rejects stale, duplicate and competing saves without losing history", async () => {
    if (!db) {
      throw new Error("Database required");
    }
    const sources = createDatabaseSourcesAndFreshness(db);
    const input = {
      id: crypto.randomUUID(),
      projectId,
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
      url: "https://example.org/retry",
      title: "Retry research",
      accessedAt: "2026-10-10T10:00:00.000Z",
      capturedContent: "First capture",
    };
    const first = await sources.create(accountId, input);
    expect(await sources.create(accountId, input)).toEqual(first);
    await expect(
      sources.create(accountId, {
        ...input,
        clientIdempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      sources.create(accountId, {
        ...input,
        capturedContent: "Changed retry payload",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const { id, ...fields } = input;
    const next = {
      ...fields,
      sourceId: id,
      baseRevision: 1,
      clientIdempotencyKey: crypto.randomUUID(),
      capturedContent: "Second capture",
    };
    const alternative = {
      ...next,
      clientIdempotencyKey: crypto.randomUUID(),
      capturedContent: "Competing capture",
    };
    const competing = await Promise.allSettled([
      sources.saveVersion(accountId, next),
      sources.saveVersion(accountId, alternative),
    ]);
    expect(
      competing.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      competing.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    await expect(
      sources.saveVersion(accountId, {
        ...next,
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const reopened = await sources.find(accountId, { sourceId: id, projectId });
    expect(reopened?.versions).toHaveLength(2);
    expect(reopened?.versions[0]?.capturedContent).toBe("First capture");
    const retry = competing[0]?.status === "fulfilled" ? next : alternative;
    expect(await sources.saveVersion(accountId, retry)).toEqual(
      reopened?.record,
    );
  });
  test("isolates Project ownership, keeps archived Sources readable, and rejects archived or missing writes", async () => {
    if (!db) {
      throw new Error("Database required");
    }
    const sources = createDatabaseSourcesAndFreshness(db);
    const input = {
      id: crypto.randomUUID(),
      projectId,
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
      url: "https://example.org/access",
      title: "Access research",
      accessedAt: "2026-10-10T10:00:00.000Z",
      capturedContent: "Access excerpt",
    };
    const saved = await sources.create(accountId, input);
    const selection = { sourceId: input.id, projectId };
    const { id, ...fields } = input;
    const next = {
      ...fields,
      sourceId: id,
      baseRevision: 1,
      clientIdempotencyKey: crypto.randomUUID(),
    };
    expect(await sources.find("another-account", selection)).toBeNull();
    expect(await sources.list("another-account", projectId)).toBeNull();
    expect(
      await sources.create("another-account", {
        ...input,
        id: crypto.randomUUID(),
      }),
    ).toBeNull();
    expect(await sources.saveVersion("another-account", next)).toBeNull();
    expect(
      await sources.saveVersion(accountId, {
        ...next,
        projectId: "missing-project",
      }),
    ).toBeNull();
    await expect(
      sources.saveVersion(accountId, {
        ...next,
        sourceId: "missing-source",
        baseRevision: 0,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await db
      .update(project)
      .set({ archivedAt: new Date() })
      .where(eq(project.id, projectId));
    try {
      expect(await sources.find(accountId, selection)).toMatchObject({
        record: saved,
        readOnly: true,
      });
      expect(
        await sources.create(accountId, { ...input, id: crypto.randomUUID() }),
      ).toBeNull();
      expect(await sources.saveVersion(accountId, next)).toBeNull();
    } finally {
      await db
        .update(project)
        .set({ archivedAt: null })
        .where(
          and(eq(project.id, projectId), eq(project.workspaceId, workspaceId)),
        );
    }
    expect((await sources.find(accountId, selection))?.versions).toHaveLength(
      1,
    );
  });
});
