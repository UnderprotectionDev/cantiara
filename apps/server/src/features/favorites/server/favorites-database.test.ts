// biome-ignore-all lint/performance/noAwaitInLoops: Membership transitions and their non-write counterparts must be observed in sequence.

import type { Context } from "@cantiara/api/context";
import type { FavoriteSource } from "@cantiara/api/favorites";
import { appRouter } from "@cantiara/api/routers/index";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { projectBacklogOrder } from "@cantiara/db/schema/backlog";
import { dailyFocusMembership } from "@cantiara/db/schema/daily-focus";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import {
  focusPeriod,
  focusPeriodActiveWork,
  focusPeriodMembership,
} from "@cantiara/db/schema/focus-period";
import { project } from "@cantiara/db/schema/project";
import { smartCollection } from "@cantiara/db/schema/smart-collection";
import { work } from "@cantiara/db/schema/work";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createDatabaseFavorites } from "./favorites-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Favorites membership", () => {
  const database = createDb({
    DATABASE_URL: databaseUrl ?? "postgresql://unused",
  });
  const accountId = crypto.randomUUID();
  const otherAccountId = crypto.randomUUID();
  const workspaceId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const workId = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  const wikiDocumentId = crypto.randomUUID();
  const decisionId = crypto.randomUUID();
  const collectionId = crypto.randomUUID();
  const favorites = createDatabaseFavorites(database);
  const sources: FavoriteSource[] = [
    { sourceRecordType: "Project", sourceRecordId: projectId },
    { sourceRecordType: "Work", sourceRecordId: workId },
    { sourceRecordType: "Document", sourceRecordId: documentId },
    { sourceRecordType: "Document", sourceRecordId: wikiDocumentId },
    { sourceRecordType: "Decision", sourceRecordId: decisionId },
    { sourceRecordType: "Smart Collection", sourceRecordId: collectionId },
  ];

  beforeEach(async () => {
    await database.insert(user).values(
      [accountId, otherAccountId].map((id) => ({
        id,
        email: `${id}@example.invalid`,
        name: "Favorites Founder",
      })),
    );
    await database
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await database.insert(project).values({
      id: projectId,
      workspaceId,
      name: "Favorites Project",
      shortCode: "FAV",
      starterConfiguration: "Blank Project",
      scope: "Keep source scope",
      status: "Completed",
    });
    await database.insert(work).values({
      id: workId,
      projectId,
      number: 1,
      key: "FAV-1",
      title: "Favorite Work",
      type: "Bug",
      status: "Closed",
      closureResult: "Completed",
    });
    await database.insert(document).values([
      {
        id: documentId,
        projectId,
        title: "Favorite Document",
        body: "Keep original content",
      },
      {
        id: wikiDocumentId,
        workspaceId,
        title: "Favorite Wiki",
        body: "Keep Wiki ownership",
      },
    ]);
    await database.insert(decision).values({
      id: decisionId,
      projectId,
      title: "Favorite Decision",
      decision: "Keep the source decision",
      life: "Withdrawn",
    });
    await database.insert(smartCollection).values({
      id: collectionId,
      projectId,
      name: "Favorite Collection",
      scope: { projectIds: [projectId] },
      conditions: { status: "Closed" },
    });
    await database
      .insert(projectBacklogOrder)
      .values({ projectId, revision: 4, workIds: [workId] });
  });
  afterEach(async () => {
    await database.delete(user).where(eq(user.id, accountId));
    await database.delete(user).where(eq(user.id, otherAccountId));
  });
  afterAll(async () => {
    await database.$client.end();
  });

  async function sourceAndPlanningState() {
    return {
      projects: await database
        .select()
        .from(project)
        .where(eq(project.workspaceId, workspaceId)),
      works: await database
        .select()
        .from(work)
        .where(eq(work.projectId, projectId)),
      documents: await database
        .select()
        .from(document)
        .where(eq(document.projectId, projectId)),
      wiki: await database
        .select()
        .from(document)
        .where(eq(document.workspaceId, workspaceId)),
      decisions: await database
        .select()
        .from(decision)
        .where(eq(decision.projectId, projectId)),
      collections: await database
        .select()
        .from(smartCollection)
        .where(eq(smartCollection.projectId, projectId)),
      backlog: await database
        .select()
        .from(projectBacklogOrder)
        .where(eq(projectBacklogOrder.projectId, projectId)),
      dailyFocus: await database
        .select()
        .from(dailyFocusMembership)
        .where(eq(dailyFocusMembership.workspaceId, workspaceId)),
      focusPeriods: await database
        .select()
        .from(focusPeriod)
        .where(eq(focusPeriod.workspaceId, workspaceId)),
      activeWork: await database
        .select()
        .from(focusPeriodActiveWork)
        .where(eq(focusPeriodActiveWork.workId, workId)),
      focusMemberships: await database
        .select()
        .from(focusPeriodMembership)
        .where(eq(focusPeriodMembership.workId, workId)),
    };
  }

  function clientFor(principal: string | null) {
    const context = {
      db: database,
      favorites,
      auth: null,
      session: principal
        ? { session: { id: "favorite-session" }, user: { id: principal } }
        : null,
    } as Context;
    return createRouterClient(appRouter, { context });
  }

  test("authenticates membership and rejects unsupported or source-changing input", async () => {
    const source = {
      sourceRecordId: workId,
      sourceRecordType: "Work" as const,
    };
    const client = clientFor(accountId);
    await expect(client.favoriteMembership(source)).resolves.toEqual({
      isFavorite: false,
    });
    await expect(client.addToFavorites(source)).resolves.toEqual({
      status: true,
    });
    await expect(client.favoriteMembership(source)).resolves.toEqual({
      isFavorite: true,
    });
    await expect(client.removeFromFavorites(source)).resolves.toEqual({
      status: true,
    });
    await expect(client.favoriteMembership(source)).resolves.toEqual({
      isFavorite: false,
    });
    for (const operation of [
      "favoriteMembership",
      "addToFavorites",
      "removeFromFavorites",
    ] as const) {
      await expect(clientFor(null)[operation](source)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      await expect(
        client[operation]({ ...source, sourceRecordType: "Risk" } as never),
      ).rejects.toThrow();
      await expect(
        client[operation]({ ...source, projectId: "other-project" } as never),
      ).rejects.toThrow();
    }
  });

  test("keeps membership private and rejects unavailable sources", async () => {
    await database
      .insert(workspace)
      .values({ id: crypto.randomUUID(), ownerAccountId: otherAccountId });
    for (const source of sources) {
      await favorites.add(accountId, source);
      await expect(
        clientFor(otherAccountId).addToFavorites(source),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Source record is unavailable.",
      });
      expect(await favorites.contains(otherAccountId, source)).toBe(false);
      await favorites.remove(otherAccountId, source);
      expect(await favorites.contains(accountId, source)).toBe(true);
    }
    await expect(
      favorites.add(accountId, {
        sourceRecordId: "missing",
        sourceRecordType: "Work",
      }),
    ).rejects.toThrow("Source record is unavailable.");
    await database
      .update(work)
      .set({ trashedAt: new Date() })
      .where(eq(work.id, workId));
    await expect(
      favorites.add(accountId, {
        sourceRecordId: workId,
        sourceRecordType: "Work",
      }),
    ).rejects.toThrow("Source record is unavailable.");
  });

  test("deduplicates concurrent additions and allows removal after source deletion", async () => {
    const source = {
      sourceRecordId: documentId,
      sourceRecordType: "Document" as const,
    };
    await Promise.all([
      favorites.add(accountId, source),
      favorites.add(accountId, source),
    ]);
    expect(await favorites.contains(accountId, source)).toBe(true);
    await database.delete(document).where(eq(document.id, documentId));
    expect(await favorites.contains(accountId, source)).toBe(true);
    await favorites.remove(accountId, source);
    expect(await favorites.contains(accountId, source)).toBe(false);
  });

  test("adds and removes every supported source without changing or copying sources or planning", async () => {
    const before = await sourceAndPlanningState();
    for (const source of sources) {
      expect(await favorites.contains(accountId, source)).toBe(false);
      await favorites.add(accountId, source);
      await favorites.add(accountId, source);
      expect(await favorites.contains(accountId, source)).toBe(true);
      expect(await sourceAndPlanningState()).toEqual(before);
      await favorites.remove(accountId, source);
      await favorites.remove(accountId, source);
      expect(await favorites.contains(accountId, source)).toBe(false);
      expect(await sourceAndPlanningState()).toEqual(before);
    }
  });
});
