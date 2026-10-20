import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
} from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { specChangeReview } from "@cantiara/db/schema/spec-change-review";
import { work } from "@cantiara/db/schema/work";
import { createRouterClient } from "@orpc/server";
import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabaseDocumentMutationContracts,
  createDatabaseDocuments,
} from "../../documents/server/documents-database";
import { createSpecChangeReview } from "./spec-change-review";
import { createDatabaseSpecChangeReviewStore } from "./spec-change-review-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Spec Change Review PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `spec-review-${crypto.randomUUID()}`;
  const otherAccountId = `spec-review-other-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const projectId = `project-${crypto.randomUUID()}`;

  function client(principalAccountId = accountId) {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const documents = createDatabaseDocuments(database);
    const context: Context = {
      accountAccess: {
        listSessions: async () => [],
        revokeOtherSessions: async () => undefined,
        revokeSession: async () => undefined,
      },
      accountPreferences: {
        get: () => Promise.reject(new Error("Not part of this test.")),
      },
      auth: null,
      db: database,
      documentMutationContracts:
        createDatabaseDocumentMutationContracts(database),
      documents,
      githubAvailability: { getStatus: () => "available" },
      session: {
        session: { id: "session-1" },
        user: { id: principalAccountId },
      } as Context["session"],
      specChangeReview: createSpecChangeReview(
        createDatabaseSpecChangeReviewStore(database),
        documents,
      ),
    };
    return createRouterClient(appRouter, { context });
  }

  async function createDocument(title: string, body: string) {
    return await client().createDocument({
      baseRevision: 0,
      body,
      clientIdempotencyKey: crypto.randomUUID(),
      projectId,
      title,
      type: "Spec",
    });
  }

  async function insertWork(
    id: string,
    type: "Feature" | "Task",
    primarySpecId: string | null,
    number: number,
  ) {
    await database?.insert(work).values({
      id,
      key: `SCR-${number}`,
      number,
      primarySpecId,
      projectId,
      title: `Work ${number}`,
      type,
    });
  }

  beforeEach(async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(user).values([
      { email: `${accountId}@example.invalid`, id: accountId, name: "Founder" },
      {
        email: `${otherAccountId}@example.invalid`,
        id: otherAccountId,
        name: "Other",
      },
    ]);
    await database
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await database.insert(project).values({
      id: projectId,
      name: "Spec review",
      shortCode: `SCR-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      starterConfiguration: "Blank Project",
      workspaceId,
    });
  });

  afterEach(async () => {
    const actors = [accountId, otherAccountId];
    await database
      ?.delete(mutationHistory)
      .where(inArray(mutationHistory.actorId, actors));
    await database
      ?.delete(mutationReceipt)
      .where(inArray(mutationReceipt.actorId, actors));
    await database
      ?.delete(mutationStaging)
      .where(inArray(mutationStaging.actorId, actors));
    await database?.delete(user).where(inArray(user.id, actors));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  async function saveVersion(
    documentId: string,
    baseRevision: number,
    body: string,
  ) {
    return await client().updateDocument({
      baseRevision,
      body,
      clientIdempotencyKey: crypto.randomUUID(),
      documentId,
    });
  }

  it("opens a review of the exact pair only for a Feature's Primary spec", async () => {
    const spec = await createDocument("Spec", "## A {#a}\nOne");
    const other = await createDocument("Notes", "Notes");
    await insertWork("feature-bound", "Feature", spec.id, 1);
    await insertWork("feature-unbound", "Feature", null, 2);
    await insertWork("task-bound", "Task", spec.id, 3);

    await saveVersion(other.id, other.revision, "Notes v2");
    expect(await client().projectSpecChangeReviews({ projectId })).toEqual([]);

    const saved = await saveVersion(spec.id, spec.revision, "## A {#a}\nTwo");
    const queue = await client().projectSpecChangeReviews({ projectId });
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      documentId: spec.id,
      featureId: "feature-bound",
      nextRevision: saved.revision,
      previousRevision: spec.revision,
    });
    const detail = await client().specChangeReview({
      reviewId: queue[0]?.id ?? "",
    });
    expect(detail.diff.sections).toHaveLength(1);
    expect(detail.diff.sections[0]).toMatchObject({
      change: "Changed",
      sectionId: "a",
    });
  });

  it("keeps earlier reviews when a newer version is saved", async () => {
    const spec = await createDocument("Spec", "One");
    await insertWork("feature-bound", "Feature", spec.id, 1);
    const second = await saveVersion(spec.id, spec.revision, "Two");
    await saveVersion(spec.id, second.revision, "Three");

    const queue = await client().projectSpecChangeReviews({ projectId });
    expect(
      queue.map(({ previousRevision, nextRevision }) => [
        previousRevision,
        nextRevision,
      ]),
    ).toEqual([
      [2, 3],
      [1, 2],
    ]);
  });

  it("stores the version pair only and hides the queue from another Account", async () => {
    const spec = await createDocument("Spec", "One");
    await insertWork("feature-bound", "Feature", spec.id, 1);
    await saveVersion(spec.id, spec.revision, "Two");

    const rows = await database?.select().from(specChangeReview);
    expect(Object.keys(rows?.[0] ?? {}).sort()).toEqual([
      "createdAt",
      "documentId",
      "featureId",
      "id",
      "nextRevision",
      "previousRevision",
      "projectId",
    ]);
    await expect(
      client(otherAccountId).projectSpecChangeReviews({ projectId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client(otherAccountId).specChangeReview({
        reviewId: rows?.[0]?.id ?? "",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
