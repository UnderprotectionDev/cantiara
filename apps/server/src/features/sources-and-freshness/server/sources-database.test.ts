import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { usageLink, workRelation } from "@cantiara/db/schema/relation";
import { createRouterClient } from "@orpc/server";
import { and, eq, or } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createSmartLinkPreview } from "./smart-link-preview";
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
  test("keeps preview transient and preserves the saved snapshot after the outside page changes", async () => {
    if (!db) {
      throw new Error("Database required");
    }
    let content = "Original finding.";
    const smartLinkPreview = createSmartLinkPreview({
      resolve: async () => ["93.184.216.34"],
      request: async () => ({
        status: 200,
        headers: { "content-type": "text/html" },
        body: new TextEncoder().encode(
          `<title>Research</title><p>${content}</p>`,
        ),
      }),
    });
    const sourcesAndFreshness = createDatabaseSourcesAndFreshness(db);
    const context = {
      db,
      sourcesAndFreshness,
      smartLinkPreview,
      session: { session: { id: "preview-session" }, user: { id: accountId } },
    } as Context;
    const client = createRouterClient(appRouter, { context });
    const before = await client.projectSources({ projectId });
    const preview = await client.smartLinkPreview({
      url: "https://example.org/research",
    });
    expect(await client.projectSources({ projectId })).toEqual(before);
    const id = crypto.randomUUID();
    await client.createSource({
      id,
      projectId,
      baseRevision: 0,
      clientIdempotencyKey: crypto.randomUUID(),
      url: preview.url,
      title: preview.title,
      accessedAt: preview.accessedAt,
      capturedContent: preview.capturedContent,
    });
    content = "Changed outside finding.";
    expect(
      (await client.smartLinkPreview({ url: preview.url })).capturedContent,
    ).toBe("Changed outside finding.");
    expect(await client.source({ sourceId: id, projectId })).toMatchObject({
      record: {
        revision: 1,
        version: { capturedContent: "Original finding." },
      },
      versions: [{ revision: 1, capturedContent: "Original finding." }],
    });
    const anonymous = createRouterClient(appRouter, {
      context: { ...context, session: null },
    });
    await expect(
      anonymous.smartLinkPreview({ url: preview.url }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
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

(url ? describe : describe.skip)("Source recheck approval", () => {
  test("keeps a dated candidate across reload and approves it only after an explicit decision", async () => {
    if (!url) {
      throw new Error("Database required");
    }
    const db = createDb({ DATABASE_URL: url });
    const accountId = crypto.randomUUID();
    const workspaceId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
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
      name: "Recheck",
      shortCode: `R${accountId.slice(0, 6).toUpperCase()}`,
      starterConfiguration: "Blank Project",
    });
    try {
      const sources = createDatabaseSourcesAndFreshness(db);
      const id = crypto.randomUUID();
      await sources.create(accountId, {
        id,
        projectId,
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        url: "https://example.org/old",
        title: "Original",
        accessedAt: "2026-10-01T09:00:00Z",
        capturedContent: "Original finding.",
      });
      const { createDatabaseSourceRecheck } = await import(
        "./source-recheck-database"
      );
      const rechecks = createDatabaseSourceRecheck(
        db,
        createSmartLinkPreview({
          resolve: async () => ["93.184.216.34"],
          request: async (
            targetUrl,
          ): Promise<{
            status: number;
            headers: Record<string, string>;
            body: Uint8Array;
          }> =>
            targetUrl.pathname === "/old"
              ? {
                  status: 302,
                  headers: { location: "/new" },
                  body: new Uint8Array(),
                }
              : {
                  status: 200,
                  headers: { "content-type": "text/plain" },
                  body: new TextEncoder().encode("New finding."),
                },
        }),
      );
      const context = {
        db,
        sourcesAndFreshness: sources,
        sourceRecheck: rechecks,
        session: {
          session: { id: "recheck-session" },
          user: { id: accountId },
        },
      } as Context;
      const client = createRouterClient(appRouter, { context });
      const anonymous = createRouterClient(appRouter, {
        context: { ...context, session: null },
      });
      const input = {
        id: crypto.randomUUID(),
        sourceId: id,
        projectId,
        expectedSourceRevision: 1,
      };
      await expect(anonymous.recheckSource(input)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      const check = await client.recheckSource(input);
      expect(check).toMatchObject({
        comparedRevision: 1,
        decision: null,
        candidate: {
          url: "https://example.org/new",
          capturedContent: "New finding.",
        },
        checkedBy: accountId,
      });
      expect(await rechecks.recheck(accountId, input)).toEqual(check);
      expect(
        await sources.find(accountId, { sourceId: id, projectId }),
      ).toMatchObject({ record: { revision: 1 } });
      expect(
        await rechecks.list("other-account", { sourceId: id, projectId }),
      ).toBeNull();
      expect(
        await rechecks.list(accountId, { sourceId: id, projectId }),
      ).toEqual([check]);
      const decision = {
        sourceId: id,
        projectId,
        checkId: input.id,
        baseRevision: 1,
        expectedSourceRevision: 1,
        clientIdempotencyKey: crypto.randomUUID(),
        decision: "Save as new Source version" as const,
      };
      expect(await rechecks.decide(accountId, decision)).toMatchObject({
        approvedRevision: 2,
      });
      expect(await rechecks.decide(accountId, decision)).toMatchObject({
        approvedRevision: 2,
      });
      expect(
        (await sources.find(accountId, { sourceId: id, projectId }))?.versions,
      ).toMatchObject([
        { revision: 1, capturedContent: "Original finding." },
        { revision: 2, capturedContent: "New finding." },
      ]);
      await expect(
        client.recheckSource({ ...input, id: crypto.randomUUID() }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const failure = createDatabaseSourceRecheck(
        db,
        createSmartLinkPreview({
          resolve: async () => ["93.184.216.34"],
          request: async () => ({
            status: 404,
            headers: { "content-type": "text/html" },
            body: new Uint8Array(),
          }),
        }),
      );
      const failed = await failure.recheck(accountId, {
        ...input,
        id: crypto.randomUUID(),
        expectedSourceRevision: 2,
      });
      expect(failed).toMatchObject({
        candidate: null,
        error: expect.stringContaining("HTTP 404"),
        comparedRevision: 2,
        fingerprint: null,
      });
      if (!failed) {
        throw new Error("Source Check required");
      }
      const failedDecision = {
        ...decision,
        checkId: failed.id,
        expectedSourceRevision: 2,
        clientIdempotencyKey: crypto.randomUUID(),
      };
      await expect(
        failure.decide(accountId, failedDecision),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        await failure.decide(accountId, {
          ...failedDecision,
          clientIdempotencyKey: crypto.randomUUID(),
          decision: "Keep current version",
        }),
      ).toMatchObject({
        decision: "Keep current version",
        approvedRevision: null,
      });
      expect(
        (await sources.find(accountId, { sourceId: id, projectId }))?.versions,
      ).toHaveLength(2);
      const videoId = crypto.randomUUID();
      const videoUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      await sources.create(accountId, {
        id: videoId,
        projectId,
        baseRevision: 0,
        clientIdempotencyKey: crypto.randomUUID(),
        url: videoUrl,
        title: "Original video",
        accessedAt: "2026-10-01T09:00:00Z",
        capturedContent: "Original video",
        provider: "YouTube",
      });
      const videoChecks = createDatabaseSourceRecheck(
        db,
        createSmartLinkPreview({
          resolve: async () => ["93.184.216.34"],
          request: async () => ({
            status: 200,
            headers: { "content-type": "application/json" },
            body: new TextEncoder().encode('{"title":"Updated video"}'),
          }),
        }),
      );
      const videoCheck = await videoChecks.recheck(accountId, {
        id: crypto.randomUUID(),
        sourceId: videoId,
        projectId,
        expectedSourceRevision: 1,
      });
      expect(videoCheck?.candidate?.url).toBe(videoUrl);
      expect(videoCheck?.fetchResult?.finalUrl).toContain("/oembed?");
      if (!videoCheck) {
        throw new Error("Source Check required");
      }
      await videoChecks.decide(accountId, {
        sourceId: videoId,
        projectId,
        checkId: videoCheck.id,
        baseRevision: videoCheck.revision,
        expectedSourceRevision: 1,
        clientIdempotencyKey: crypto.randomUUID(),
        decision: "Save as new Source version",
      });
      expect(
        (await sources.find(accountId, { sourceId: videoId, projectId }))
          ?.record.version.url,
      ).toBe(videoUrl);
      await db
        .update(project)
        .set({ archivedAt: new Date() })
        .where(eq(project.id, projectId));
      expect(
        await failure.recheck(accountId, {
          ...input,
          id: crypto.randomUUID(),
          expectedSourceRevision: 2,
        }),
      ).toBeNull();
      expect(
        await failure.list(accountId, { sourceId: id, projectId }),
      ).toHaveLength(2);
    } finally {
      await db.delete(user).where(eq(user.id, accountId));
      await db.$client.end();
    }
  });
});
